"""The HTTP door: sign-in, limits, provider failures and Slack."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import anthropic
import httpx
import pytest

from rooted_ai import slack
from tests.conftest import AUTH, NOW, SETTINGS, reply

DAY = "spend:2026-11-06"  # NOW, as a UTC day

CHAT = {"task": "chat", "payload": {"question": "What did we decide on pricing?", "decisions": [{"id": "d-1", "question": "Pricing?"}]}}
REQ = httpx.Request("POST", "https://api.anthropic.com/v1/messages")


def test_health(env):
    assert env.client.get("/health").json() == {"ok": True}


def test_no_sign_in_no_answer(env):
    res = env.client.post("/agent", json=CHAT)
    assert res.status_code == 401 and res.json()["error"] == "sign_in_required"
    res = env.client.post("/agent", json=CHAT, headers={"Authorization": "Bearer stolen"})
    assert res.status_code == 401
    assert env.claude.calls == []


def test_when_supabase_is_down_it_says_so(env):
    res = env.client.post("/agent", json=CHAT, headers={"Authorization": "Bearer down"})
    assert res.status_code == 503 and res.json()["error"] == "auth_unavailable"


def test_answers_through_claude_sonnet_with_fallbacks_and_a_schema(env):
    env.claude.answers.append(reply({"text": "Per workspace.", "citations": ["d-1", "d-x"]}))
    res = env.client.post("/agent", json=CHAT, headers=AUTH)
    assert res.json() == {"ok": True, "result": {"text": "Per workspace.", "citations": ["d-1"]}}
    call = env.claude.calls[0]
    assert call["model"] == "claude-sonnet-5-5"
    assert call["fallbacks"] == "default" and call["betas"] == ["server-side-fallback-2026-07-01"]
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert call["output_config"]["effort"] == "low"
    # 1,000 input and 200 output tokens at Sonnet 5.5 prices.
    assert env.store.get(DAY) == pytest.approx((1000 * 2 + 200 * 10) / 1_000_000)


def test_unknown_tasks_bad_json_and_huge_bodies_are_refused(env):
    assert env.client.post("/agent", json={"task": "rm -rf", "payload": {}}, headers=AUTH).json()["error"] == "unknown_task"
    assert env.client.post("/agent", content=b"{not json", headers=AUTH).json()["error"] == "bad_json"
    res = env.client.post("/agent", content=b"x" * 600_000, headers=AUTH)
    assert res.status_code == 413
    assert env.claude.calls == []


def test_a_payload_the_task_cant_use_is_refused_before_claude(env):
    res = env.client.post("/agent", json={"task": "chat", "payload": {"question": ""}}, headers=AUTH)
    assert res.status_code == 400 and res.json()["error"] == "bad_payload"
    assert env.claude.calls == []


def test_each_person_has_a_rate_limit(env):
    for _ in range(5):
        env.claude.answers.append(reply({"text": "ok", "citations": []}))
        assert env.client.post("/agent", json=CHAT, headers=AUTH).status_code == 200
    res = env.client.post("/agent", json=CHAT, headers=AUTH)
    assert res.status_code == 429 and res.json()["error"] == "rate_limited"
    # Someone else isn't held back by it.
    env.claude.answers.append(reply({"text": "ok", "citations": []}))
    assert env.client.post("/agent", json=CHAT, headers={"Authorization": "Bearer other-token"}).status_code == 200


def test_each_call_reserves_its_worst_case_so_a_burst_cant_overrun_the_cap(env):
    # The test budget is $1; a chat call's worst case is about $0.04 (4,000 output tokens).
    env.store.put(DAY, 0.97)
    res = env.client.post("/agent", json=CHAT, headers=AUTH)
    assert res.status_code == 503 and res.json()["error"] == "budget_reached"
    assert env.claude.calls == []
    env.store.put(DAY, 0.5)
    env.claude.answers.append(reply({"text": "ok", "citations": []}))
    assert env.client.post("/agent", json=CHAT, headers=AUTH).status_code == 200
    # Once settled, only what the call really cost stays counted.
    assert env.store.get(DAY) == pytest.approx(0.5 + (1000 * 2 + 200 * 10) / 1_000_000)


def test_the_daily_budget_stops_every_call_once_spent(env):
    env.store.put(DAY, 1.0)  # the test budget is $1
    res = env.client.post("/agent", json=CHAT, headers=AUTH)
    assert res.status_code == 503 and res.json()["error"] == "budget_reached"
    assert env.claude.calls == []


def test_a_refusal_is_an_error_and_still_counts_toward_spend(env):
    env.claude.answers.append(reply(text="", stop_reason="refusal"))
    res = env.client.post("/agent", json=CHAT, headers=AUTH)
    assert res.status_code == 502 and res.json()["error"] == "refused"
    assert env.store.get(DAY) > 0


def test_malformed_or_ungrounded_output_is_an_error_not_an_answer(env):
    env.claude.answers.append(reply(text="not json at all"))
    assert env.client.post("/agent", json=CHAT, headers=AUTH).json()["error"] == "bad_output"
    env.claude.answers.append(reply({"text": "   ", "citations": []}))
    assert env.client.post("/agent", json=CHAT, headers=AUTH).json()["error"] == "bad_output"
    env.claude.answers.append(reply(text='{"text": "cut off', stop_reason="max_tokens"))
    assert env.client.post("/agent", json=CHAT, headers=AUTH).json()["error"] == "too_long"


def test_provider_failures_become_codes_the_app_can_explain(env):
    cases = [
        (anthropic.RateLimitError("busy", response=httpx.Response(429, request=REQ), body=None), "provider_busy"),
        (anthropic.InternalServerError("boom", response=httpx.Response(500, request=REQ), body=None), "provider_error"),
        # A key Anthropic refuses is the deployer's to fix, not "no AI here".
        (anthropic.AuthenticationError("bad key", response=httpx.Response(401, request=REQ), body=None), "provider_key"),
        (anthropic.APITimeoutError(request=REQ), "provider_timeout"),
        (anthropic.APIConnectionError(request=REQ), "provider_unreachable"),
    ]
    for error, code in cases:
        env.claude.answers.append(error)
        res = env.client.post("/agent", json=CHAT, headers=AUTH)
        assert res.json() == {"ok": False, "error": code}
    # Failed calls still count toward the person's limit (5 in the test window).
    assert env.client.post("/agent", json=CHAT, headers=AUTH).status_code == 429


def test_a_key_without_access_is_reported_as_a_key_problem(env):
    env.claude.answers.append(anthropic.PermissionDeniedError("no access", response=httpx.Response(403, request=REQ), body=None))
    res = env.client.post("/agent", json=CHAT, headers=AUTH)
    assert res.status_code == 503
    assert res.json() == {"ok": False, "error": "provider_key"}


def test_demo_brief_reads_the_sample_messages_it_was_sent(env):
    env.claude.answers.append(reply({"items": [{"ref": "s-1", "group": "Customer signal"}], "gaps": [{"question": "How many seats?"}]}))
    payload = {
        "decision": {"question": "Per seat?"},
        "source": {"kind": "sample"},
        "messages": [{"ref": "s-1", "source": "#pricing", "author": "Priya", "date": "2026-10-01", "text": "Buyers ask about seats"}],
    }
    res = env.client.post("/agent", json={"task": "brief", "payload": payload}, headers=AUTH).json()
    assert res["ok"] and res["result"]["items"][0]["text"] == "Buyers ask about seats"
    assert env.slack_api.calls == []


def test_a_slack_brief_needs_slack_connected(env):
    payload = {"decision": {"question": "Per seat?"}, "source": {"kind": "slack", "channelIds": ["C1"]}}
    res = env.client.post("/agent", json={"task": "brief", "payload": payload}, headers=AUTH)
    assert res.status_code == 409 and res.json()["error"] == "slack_not_connected"


def connect_slack(env, *users):
    for user in users or ("user-a",):
        env.store.put(f"slack:{user}", {"teamId": "T1", "teamName": "Acme", "connectedAt": 1})
    env.store.put("slack-team:T1", {"token": "xoxb-1", "users": list(users or ("user-a",))})
    env.slack_api.handlers.update(
        {
            "conversations.list": lambda **_: {
                "ok": True,
                "channels": [{"id": "C1", "name": "pricing", "num_members": 9, "is_member": False}, {"id": "C2", "name": "eng", "num_members": 4, "is_member": True}],
            },
            "conversations.history": lambda channel, **_: {
                "ok": True,
                "messages": {
                    "C1": [
                        {"ts": "1793990000.000100", "user": "U1", "text": "Seats confuse buyers"},
                        {"ts": "1793990001.000100", "subtype": "channel_join", "text": "joined"},
                        {"ts": "1793990002.000100", "bot_id": "B1", "text": "deploy done"},
                    ],
                    "C2": [{"ts": "1793990003.000100", "user": "U2", "text": "Per-workspace is simpler to bill"}],
                }[channel],
            },
            "users.info": lambda user, **_: {"ok": True, "user": {"real_name": {"U1": "Sam Rivera", "U2": "Dev Patel"}[user]}},
            "chat.getPermalink": lambda channel, message_ts, **_: {"ok": True, "permalink": f"https://acme.slack.com/archives/{channel}/p{message_ts.replace('.', '')}"},
        }
    )


def test_a_slack_brief_reads_only_allowed_public_channels_and_links_what_it_cites(env):
    connect_slack(env)
    env.claude.answers.append(reply({"items": [{"ref": "C1:1793990000.000100", "group": "Customer signal"}], "gaps": []}))
    payload = {"decision": {"question": "Per seat?"}, "source": {"kind": "slack", "channelIds": ["C1", "G-private"]}}
    res = env.client.post("/agent", json={"task": "brief", "payload": payload}, headers=AUTH).json()
    item = res["result"]["items"][0]
    assert item["author"] == "Sam Rivera" and item["source"] == "#pricing"
    assert item["link"] == "https://acme.slack.com/archives/C1/p1793990000000100"
    methods = [(m, p.get("channel")) for m, _, p in env.slack_api.calls]
    assert ("conversations.join", "C1") in methods  # joined the allowed channel it wasn't in
    assert all(ch != "G-private" for _, ch in methods)  # never touched a channel that isn't public
    assert ("conversations.history", "C2") not in methods  # not allowed this time
    sent = env.claude.calls[0]["messages"][0]["content"]
    assert "joined" not in sent and "deploy done" not in sent  # system and bot posts left out


def test_a_revoked_slack_token_says_so(env):
    connect_slack(env)
    env.slack_api.handlers["conversations.list"] = lambda **_: slack.SlackError("token_revoked")
    payload = {"decision": {"question": "Per seat?"}, "source": {"kind": "slack", "channelIds": ["C1"]}}
    assert env.client.post("/agent", json={"task": "brief", "payload": payload}, headers=AUTH).json()["error"] == "slack_token_revoked"
    # Rooted forgets a revoked token as soon as it sees one.
    status = env.client.get("/slack/status", headers=AUTH).json()["result"]
    assert status == {"available": True, "connected": False}
    assert env.store.get("slack:user-a") is None and env.store.get("slack-team:T1") is None


def test_slack_install_round_trip(env):
    url = env.client.post("/slack/install", headers=AUTH).json()["result"]["url"]
    query = parse_qs(urlparse(url).query)
    assert query["scope"] == ["channels:read,channels:history,channels:join,users:read"]
    assert query["redirect_uri"] == [SETTINGS.slack_redirect_uri]
    state = query["state"][0]
    # Slack's callback stores nothing: it hands the code back to the app.
    res = env.client.get("/slack/callback", params={"code": "abc", "state": state}, follow_redirects=False)
    assert res.status_code == 302
    back = urlparse(res.headers["location"])
    assert back.path == "/onboarding" and parse_qs(back.query) == {"slack_code": ["abc"], "slack_state": [state]}
    assert env.store.get("slack:user-a") is None
    # The signed-in person who started it finishes it.
    env.slack_api.handlers["oauth.v2.access"] = lambda **_: {"ok": True, "access_token": "xoxb-new", "team": {"id": "T9", "name": "Acme"}}
    done = env.client.post("/slack/complete", json={"code": "abc", "state": state}, headers=AUTH).json()
    assert done == {"ok": True, "result": {"connected": True, "teamName": "Acme"}}
    assert env.store.get("slack-team:T9")["token"] == "xoxb-new"
    assert env.client.get("/slack/status", headers=AUTH).json()["result"]["connected"] is True


def test_someone_else_cant_finish_an_install_they_didnt_start(env):
    # The attacker starts an install and gets a victim to approve it on Slack.
    attacker = {"Authorization": "Bearer other-token"}
    state = parse_qs(urlparse(env.client.post("/slack/install", headers=attacker).json()["result"]["url"]).query)["state"][0]
    env.slack_api.handlers["oauth.v2.access"] = lambda **_: {"ok": True, "access_token": "xoxb-victim", "team": {"id": "TV", "name": "Victim"}}
    # The victim's browser lands back in Rooted, signed in as the victim.
    res = env.client.post("/slack/complete", json={"code": "abc", "state": state}, headers=AUTH)
    assert res.status_code == 403 and res.json()["error"] == "slack_state_mismatch"
    assert not any(m == "oauth.v2.access" for m, _, _ in env.slack_api.calls)  # the code is never exchanged
    assert env.store.get("slack:user-b") is None and env.store.get("slack:user-a") is None


def test_completing_an_install_needs_sign_in(env):
    state = slack.make_state(SETTINGS, "user-a", NOW)
    res = env.client.post("/slack/complete", json={"code": "abc", "state": state})
    assert res.status_code == 401


def test_forged_or_expired_install_state_is_refused_and_cancel_is_handled(env):
    for state in ("eyJ1IjoidXNlci1hIn0.bad", slack.make_state(SETTINGS, "user-a", NOW - 3600)):
        res = env.client.post("/slack/complete", json={"code": "abc", "state": state}, headers=AUTH)
        assert res.status_code == 400 and res.json()["error"] == "slack_state_expired"
    cancelled = env.client.get("/slack/callback", params={"error": "access_denied"}, follow_redirects=False)
    assert cancelled.headers["location"].endswith("?slack=cancelled")
    assert not any(m == "oauth.v2.access" for m, _, _ in env.slack_api.calls)
    assert env.store.get("slack:user-a") is None


def test_disconnect_revokes_the_token_and_forgets_it(env):
    connect_slack(env)
    assert env.client.post("/slack/disconnect", headers=AUTH).json()["result"] == {"connected": False}
    assert ("auth.revoke", "xoxb-1") in [(m, t) for m, t, _ in env.slack_api.calls]
    assert env.store.get("slack:user-a") is None and env.store.get("slack-team:T1") is None


def test_one_person_disconnecting_doesnt_cut_off_a_colleague_in_the_same_workspace(env):
    connect_slack(env, "user-a", "user-b")
    env.client.post("/slack/disconnect", headers=AUTH)
    assert "auth.revoke" not in [m for m, _, _ in env.slack_api.calls]
    assert env.store.get("slack-team:T1") == {"token": "xoxb-1", "users": ["user-b"]}
    other = {"Authorization": "Bearer other-token"}
    assert env.client.get("/slack/status", headers=other).json()["result"]["connected"] is True
    # The last one out revokes it.
    env.client.post("/slack/disconnect", headers=other)
    assert ("auth.revoke", "xoxb-1") in [(m, t) for m, t, _ in env.slack_api.calls]


def test_a_rate_limited_slack_keeps_what_was_read(env):
    connect_slack(env)
    history = env.slack_api.handlers["conversations.history"]
    env.slack_api.handlers["conversations.history"] = lambda channel, **kw: slack.SlackError("slack_rate_limited") if channel == "C2" else history(channel=channel, **kw)
    env.claude.answers.append(reply({"items": [], "gaps": [{"question": "q"}]}))
    payload = {"decision": {"question": "Per seat?"}, "source": {"kind": "slack", "channelIds": ["C1", "C2"]}}
    assert env.client.post("/agent", json={"task": "brief", "payload": payload}, headers=AUTH).json()["ok"] is True
    assert "Seats confuse buyers" in env.claude.calls[0]["messages"][0]["content"]


def test_status_lists_public_channels_when_connected(env):
    connect_slack(env)
    result = env.client.get("/slack/status", headers=AUTH).json()["result"]
    assert result["connected"] and result["teamName"] == "Acme"
    assert result["channels"] == [{"id": "C1", "name": "#pricing", "memberCount": 9}, {"id": "C2", "name": "#eng", "memberCount": 4}]


def test_one_persons_slack_is_not_anothers(env):
    connect_slack(env)
    other = {"Authorization": "Bearer other-token"}
    assert env.client.get("/slack/status", headers=other).json()["result"]["connected"] is False
    payload = {"decision": {"question": "Per seat?"}, "source": {"kind": "slack", "channelIds": ["C1"]}}
    assert env.client.post("/agent", json={"task": "brief", "payload": payload}, headers=other).json()["error"] == "slack_not_connected"


def test_status_says_revoked_when_slack_revoked_it_since_the_last_visit(env):
    connect_slack(env)
    env.slack_api.handlers["conversations.list"] = lambda **_: slack.SlackError("token_revoked")
    assert env.client.get("/slack/status", headers=AUTH).json()["result"] == {"available": True, "connected": False, "revoked": True}
