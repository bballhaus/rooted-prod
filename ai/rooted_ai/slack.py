"""The real Slack connection (decision 0017).

Rooted installs a bot into the PM's workspace with read-only scopes for public
channels. It never asks for private channels or DMs. Messages are read when a
task needs them and are not stored; only the bot token is kept, server-side.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Callable
from urllib.parse import urlencode

import httpx

from .config import Settings

# Read public channels, join the ones the PM allows, and show who wrote a message.
SCOPES = ["channels:read", "channels:history", "channels:join", "users:read"]
STATE_SECONDS = 600
DAYS_BACK = 30
PER_CHANNEL = 200
MAX_MESSAGES = 400
# Thread replies (decision 0021). conversations.history doesn't return them, and
# decisions are often settled in them. Each page of a thread is one more
# rate-limited call, so threads, pages and replies are capped; a task takes at
# most 600 messages, so top-level messages and replies are budgeted separately.
MAX_THREADS = 25  # the most recently active threads
REPLY_PAGES = 4
PER_PAGE = 50
PER_THREAD = 50  # the newest replies kept from each thread
MAX_REPLIES = 200
# Subtypes that are still a person writing: a thread reply also sent to the
# channel (often the one announcing the outcome), and a file shared with a comment.
PEOPLE_SUBTYPES = ("thread_broadcast", "file_share")
# Errors that mean the token itself is gone; anything else on a thread just skips it.
REVOKED = ("invalid_auth", "token_revoked", "account_inactive")


class SlackError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class SlackApi:
    """Thin Web API client. Tests replace `call` with a fake."""

    def __init__(self, http: httpx.Client) -> None:
        self.http = http

    def call(self, method: str, token: str | None = None, **params: Any) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        try:
            res = self.http.post(f"https://slack.com/api/{method}", data=params, headers=headers, timeout=15.0)
        except httpx.HTTPError as e:
            raise SlackError("slack_unreachable") from e
        if res.status_code == 429:
            raise SlackError("slack_rate_limited")
        body = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        if not body.get("ok"):
            raise SlackError(str(body.get("error") or f"http_{res.status_code}"))
        return body


# ── Install flow ─────────────────────────────────────────────────────────


def _sign(settings: Settings, payload: bytes) -> str:
    return base64.urlsafe_b64encode(hmac.new(settings.slack_state_secret.encode(), payload, hashlib.sha256).digest()).decode().rstrip("=")


def make_state(settings: Settings, user_id: str, now: float) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"u": user_id, "e": int(now) + STATE_SECONDS, "n": secrets.token_hex(8)}).encode()).decode()
    return f"{payload}.{_sign(settings, payload.encode())}"


def read_state(settings: Settings, state: str, now: float) -> str | None:
    """The user id the state was made for, or None if it's forged or expired."""
    try:
        payload, sig = state.split(".", 1)
        if not hmac.compare_digest(sig, _sign(settings, payload.encode())):
            return None
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (ValueError, json.JSONDecodeError):
        return None
    if int(data.get("e", 0)) < now:
        return None
    return str(data.get("u")) or None


def install_url(settings: Settings, user_id: str, now: float) -> str:
    query = urlencode(
        {
            "client_id": settings.slack_client_id,
            "scope": ",".join(SCOPES),
            "redirect_uri": settings.slack_redirect_uri,
            "state": make_state(settings, user_id, now),
        }
    )
    return f"https://slack.com/oauth/v2/authorize?{query}"


def exchange_code(api: SlackApi, settings: Settings, code: str) -> dict[str, Any]:
    body = api.call(
        "oauth.v2.access",
        client_id=settings.slack_client_id,
        client_secret=settings.slack_client_secret,
        code=code,
        redirect_uri=settings.slack_redirect_uri,
    )
    team = body.get("team") or {}
    return {"token": body["access_token"], "teamId": team.get("id", ""), "teamName": team.get("name", "")}


# ── Reading ──────────────────────────────────────────────────────────────


def list_channels(api: SlackApi, token: str) -> list[dict[str, Any]]:
    """Public, unarchived channels, with whether the bot is already in them."""
    channels: list[dict[str, Any]] = []
    cursor = ""
    for _ in range(10):  # up to 2,000 channels
        body = api.call("conversations.list", token, types="public_channel", exclude_archived="true", limit=200, cursor=cursor)
        for c in body.get("channels", []):
            channels.append({"id": c["id"], "name": f"#{c['name']}", "memberCount": c.get("num_members", 0), "isMember": bool(c.get("is_member"))})
        cursor = (body.get("response_metadata") or {}).get("next_cursor") or ""
        if not cursor:
            break
    return channels


def gather(api: SlackApi, token: str, channel_ids: list[str], clock: Callable[[], float] = time.time) -> list[dict[str, Any]]:
    """Recent messages from the allowed public channels, and the newest replies in
    their most recently active threads, newest first, as task messages. A reply
    carries replyTo, the ref of the message it answers, which is always sent too.

    Channel ids not in the workspace's public list are ignored, so the app
    can't steer the bot to a private channel.
    """
    public = {c["id"]: c for c in list_channels(api, token)}
    allowed = [public[cid] for cid in dict.fromkeys(channel_ids) if cid in public]
    oldest = str(clock() - DAYS_BACK * 86400)
    top: dict[str, dict[str, Any]] = {}
    threads: list[tuple[float, str, dict[str, Any]]] = []  # (latest activity, parent ts, channel)

    for i, channel in enumerate(allowed):
        try:
            if not channel["isMember"]:
                api.call("conversations.join", token, channel=channel["id"])
            body = api.call("conversations.history", token, channel=channel["id"], oldest=oldest, limit=PER_CHANNEL)
        except SlackError as e:
            # Slack rate-limits history reads, hard for apps distributed outside
            # its Marketplace. Keep what was read rather than fail the whole task.
            if e.code == "slack_rate_limited" and i > 0:
                break
            raise
        for m in body.get("messages", []):
            item = _message(m, channel)
            if item:
                top[item["ref"]] = item
            if m.get("reply_count") and m.get("thread_ts", m.get("ts")) == m.get("ts"):
                threads.append((float(m.get("latest_reply") or m["ts"]), m["ts"], channel))

    kept = dict(sorted(top.items(), key=lambda kv: _ts(kv[0]), reverse=True)[:MAX_MESSAGES])
    # Only threads whose parent is sent, so no reply points at a message Claude can't see.
    threads = sorted((t for t in threads if f"{t[2]['id']}:{t[1]}" in kept), key=lambda t: t[0], reverse=True)
    replies: dict[str, dict[str, Any]] = {}
    for _, parent, channel in threads[:MAX_THREADS]:
        read, stop = _thread(api, token, channel, parent)
        for m in read[-PER_THREAD:]:  # Slack pages oldest first; the newest replies matter most
            item = _message(m, channel)
            if item and item["ref"] not in kept:  # a broadcast reply is already in the history
                replies[item["ref"]] = item
        if stop:
            break  # rate-limited: keep the threads already read
    newest_replies = sorted(replies.values(), key=lambda m: _ts(m["ref"]), reverse=True)[:MAX_REPLIES]

    out = list(kept.values()) + newest_replies
    names: dict[str, str] = {}
    for item in out:  # names last, so no lookups are spent on messages that were cut
        item["author"] = _name(api, token, item.pop("user"), names)
    out.sort(key=lambda m: _ts(m["ref"]), reverse=True)
    return out


def _ts(ref: str) -> float:
    return float(ref.split(":", 1)[1])


def _message(m: dict[str, Any], channel: dict[str, Any]) -> dict[str, Any] | None:
    """A person's message as a task message, or None for joins, bots and other system posts."""
    if (m.get("subtype") and m["subtype"] not in PEOPLE_SUBTYPES) or m.get("bot_id") or "ts" not in m or not str(m.get("text", "")).strip():
        return None
    thread = m.get("thread_ts")
    return {
        "ref": f"{channel['id']}:{m['ts']}",
        "source": channel["name"],
        "user": m.get("user"),
        "date": datetime.fromtimestamp(float(m["ts"]), tz=timezone.utc).strftime("%Y-%m-%d"),
        "text": str(m["text"])[:6000],
        "link": None,
        "replyTo": f"{channel['id']}:{thread}" if thread and thread != m["ts"] else None,
    }


def _thread(api: SlackApi, token: str, channel: dict[str, Any], parent: str) -> tuple[list[dict[str, Any]], bool]:
    """The replies in one thread, oldest first, and whether Slack rate-limited the read.

    A thread that can't be read (deleted since, a timeout) is skipped, keeping
    what was read; only a revoked token fails the task.
    """
    read: list[dict[str, Any]] = []
    cursor = ""
    for _ in range(REPLY_PAGES):
        try:
            body = api.call("conversations.replies", token, channel=channel["id"], ts=parent, limit=PER_PAGE, cursor=cursor)
        except SlackError as e:
            if e.code in REVOKED:
                raise
            return read, e.code == "slack_rate_limited"
        read += [m for m in body.get("messages", []) if m.get("ts") != parent]  # Slack repeats the parent first
        cursor = (body.get("response_metadata") or {}).get("next_cursor") or ""
        if not body.get("has_more") or not cursor:
            break
    return read, False


def _name(api: SlackApi, token: str, user_id: str | None, cache: dict[str, str]) -> str | None:
    if not user_id:
        return None
    if user_id not in cache:
        try:
            profile = api.call("users.info", token, user=user_id).get("user") or {}
            cache[user_id] = profile.get("real_name") or profile.get("name") or "Someone"
        except SlackError:
            cache[user_id] = "Someone"
    return cache[user_id]


def add_permalinks(api: SlackApi, token: str, items: list[dict[str, Any]]) -> None:
    """Links for the few messages a task actually cites, so the PM can open them in Slack."""
    for item in items:
        ref = item.get("ref", "")
        if ":" not in ref:
            continue
        channel, ts = ref.split(":", 1)
        try:
            item["link"] = api.call("chat.getPermalink", token, channel=channel, message_ts=ts).get("permalink")
        except SlackError:
            item["link"] = None
