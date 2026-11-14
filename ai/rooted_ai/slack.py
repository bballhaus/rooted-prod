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
    """Recent messages from the allowed public channels, newest first, as task messages.

    Channel ids not in the workspace's public list are ignored, so the app
    can't steer the bot to a private channel.
    """
    public = {c["id"]: c for c in list_channels(api, token)}
    allowed = [public[cid] for cid in dict.fromkeys(channel_ids) if cid in public]
    oldest = str(clock() - DAYS_BACK * 86400)
    names: dict[str, str] = {}
    out: list[dict[str, Any]] = []
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
            # Skip joins, bot posts and other system messages; keep what people wrote.
            if m.get("subtype") or not str(m.get("text", "")).strip() or m.get("bot_id"):
                continue
            out.append(
                {
                    "ref": f"{channel['id']}:{m['ts']}",
                    "source": channel["name"],
                    "author": _name(api, token, m.get("user"), names),
                    "date": datetime.fromtimestamp(float(m["ts"]), tz=timezone.utc).strftime("%Y-%m-%d"),
                    "text": str(m["text"])[:6000],
                    "link": None,
                }
            )
    out.sort(key=lambda m: float(m["ref"].split(":", 1)[1]), reverse=True)
    return out[:MAX_MESSAGES]


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
