"""Reading Slack threads (decision 0021), against a fake Web API."""

from __future__ import annotations

from typing import Any

import pytest

from rooted_ai import slack
from tests.conftest import NOW, FakeSlack

DAY = 86400.0


def ts(seconds_ago: float) -> str:
    return f"{NOW - seconds_ago:.6f}"


def workspace(history: list[dict[str, Any]], threads: dict[str, list[dict[str, Any]]], fail: dict[str, Any] | None = None) -> FakeSlack:
    """One public channel, C1, with `history` and `threads` (parent ts -> replies, oldest first)."""
    api = FakeSlack()
    fail = fail or {}

    def replies(channel: str, ts: str, limit: int, cursor: str = "", **_: Any) -> Any:
        if ts in fail:
            return fail[ts]
        start = int(cursor or 0)
        page = threads[ts][start : start + limit]
        more = start + limit < len(threads[ts])
        parent = [m for m in history if m["ts"] == ts] if start == 0 else []
        return {"ok": True, "messages": parent + page, "has_more": more, "response_metadata": {"next_cursor": str(start + limit) if more else ""}}

    api.handlers.update(
        {
            "conversations.list": lambda **_: {"ok": True, "channels": [{"id": "C1", "name": "product", "is_member": True, "num_members": 5}]},
            "conversations.history": lambda **_: {"ok": True, "messages": list(reversed(history))},
            "conversations.replies": replies,
            "users.info": lambda user, **_: {"ok": True, "user": {"real_name": f"Person {user}"}},
        }
    )
    return api


def parent(t: str, latest: str | None = None, text: str = "which way?") -> dict[str, Any]:
    return {"ts": t, "user": "U1", "text": text, "thread_ts": t, "reply_count": 1, "latest_reply": latest or t}


def reply(t: str, thread: str, text: str) -> dict[str, Any]:
    return {"ts": t, "user": "U2", "text": text, "thread_ts": thread}


def read(api: FakeSlack) -> list[dict[str, Any]]:
    return slack.gather(api, "xoxb", ["C1"], clock=lambda: NOW)


def test_a_long_thread_keeps_its_newest_replies_where_it_was_settled():
    p = ts(5 * DAY)
    talk = [reply(f"{NOW - 4 * DAY + i:.6f}", p, f"thought {i}") for i in range(119)]
    final = reply(ts(DAY), p, "FINAL: per workspace")
    out = read(workspace([parent(p, final["ts"])], {p: talk + [final]}))
    texts = [m["text"] for m in out]
    assert "FINAL: per workspace" in texts
    assert sum(1 for m in out if m["replyTo"] == f"C1:{p}") == slack.PER_THREAD  # the newest ones


def test_a_thread_that_cant_be_read_is_skipped_not_the_whole_read():
    a, b = ts(3 * DAY), ts(2 * DAY)
    api = workspace([parent(a), parent(b)], {a: [reply(ts(2.5 * DAY), a, "A settled")], b: []}, fail={b: slack.SlackError("thread_not_found")})
    texts = [m["text"] for m in read(api)]
    assert "A settled" in texts and texts.count("which way?") == 2


def test_a_revoked_token_on_a_thread_still_fails_the_task():
    a = ts(DAY)
    api = workspace([parent(a)], {a: []}, fail={a: slack.SlackError("token_revoked")})
    with pytest.raises(slack.SlackError):
        read(api)


def test_rate_limited_thread_reads_keep_what_was_read_and_stop():
    a, b, c = ts(3 * DAY), ts(2 * DAY), ts(1 * DAY)
    threads = {a: [reply(ts(2.9 * DAY), a, "in a")], b: [reply(ts(1.9 * DAY), b, "in b")], c: [reply(ts(0.9 * DAY), c, "in c")]}
    api = workspace([parent(a), parent(b), parent(c)], threads, fail={b: slack.SlackError("slack_rate_limited")})
    texts = [m["text"] for m in read(api)]
    # Newest thread first: c is read, b is rate-limited, so a is never tried.
    assert "in c" in texts and "in b" not in texts and "in a" not in texts
    assert texts.count("which way?") == 3  # the channel history is kept
    asked = [p["ts"] for m, _, p in api.calls if m == "conversations.replies"]
    assert asked == [c, b]


def test_only_the_25_most_recently_active_threads_are_read():
    parents = [parent(ts((40 - i) * 3600)) for i in range(30)]  # newest last
    old_but_busy = parent(ts(20 * DAY), latest=ts(60))  # started weeks ago, settled a minute ago
    threads = {p["ts"]: [reply(f"{float(p['ts']) + 1:.6f}", p["ts"], "r")] for p in parents}
    threads[old_but_busy["ts"]] = [reply(ts(60), old_but_busy["ts"], "decided today")]
    api = workspace(parents + [old_but_busy], threads)
    out = read(api)
    asked = [p["ts"] for m, _, p in api.calls if m == "conversations.replies"]
    assert len(asked) == slack.MAX_THREADS
    assert asked[0] == old_but_busy["ts"]  # ranked by its latest reply, not when it started
    assert "decided today" in [m["text"] for m in out]


def test_a_reply_also_sent_to_the_channel_is_kept_once():
    p = ts(2 * DAY)
    broadcast = {**reply(ts(DAY), p, "Decided: per workspace"), "subtype": "thread_broadcast"}
    out = read(workspace([parent(p), broadcast], {p: [broadcast]}))
    kept = [m for m in out if m["text"] == "Decided: per workspace"]
    assert len(kept) == 1 and kept[0]["replyTo"] == f"C1:{p}"


def test_replies_never_point_at_a_message_that_was_cut_and_the_total_fits_a_task():
    # 400 newer top-level messages push an old thread's parent out.
    old = ts(29 * DAY)
    chatter = [{"ts": ts(i * 60), "user": "U3", "text": f"msg {i}"} for i in range(400)]
    busy = [parent(ts((i + 1) * 3600 + 30), text=f"thread {i}") for i in range(40)]
    threads = {p["ts"]: [reply(f"{float(p['ts']) + j + 1:.6f}", p["ts"], f"reply {j}") for j in range(10)] for p in busy}
    threads[old] = [reply(ts(60), old, "orphan?")]
    out = read(workspace([parent(old)] + busy + chatter, threads))
    refs = {m["ref"] for m in out}
    assert all(m["replyTo"] in refs for m in out if m["replyTo"])
    assert "orphan?" not in [m["text"] for m in out]
    assert len(out) <= slack.MAX_MESSAGES + slack.MAX_REPLIES <= 600
