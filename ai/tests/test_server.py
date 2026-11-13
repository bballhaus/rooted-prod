"""The HTTP door: sign-in, limits, provider failures and Slack."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import anthropic
import httpx

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


def test_answers_through_claude_opus_with_fallbacks_and_a_schema(env):
    env.claude.answers.append(reply({"text": "Per workspace.", "citations": ["d-1", "d-x"]}))
    res = env.client.post("/agent", json=CHAT, headers=AUTH)
    assert res.json() == {"ok": True, "result": {"text": "Per workspace.", "citations": ["d-1"]}}
    call = env.claude.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["fallbacks"] == "default" and call["betas"] == ["server-side-fallback-2026-07-01"]
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert call["output_config"]["effort"] == "low"
    # 1,000 input and 200 output tokens at Opus 5.5 prices.
    assert env.store.get(DAY) == (1000 * 4 + 200 * 20) / 1_000_000


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
        (anthropic.AuthenticationError("bad key", response=httpx.Response(401, request=REQ), body=None), "not_configured"),
        (anthropic.APITimeoutError(request=REQ), "provider_timeout"),
        (anthropic.APIConnectionError(request=REQ), "provider_unreachable"),
    ]
    for error, code in cases:
        env.claude.answers.append(error)
        res = env.client.post("/agent", json=CHAT, headers=AUTH)
        assert res.json() == {"ok": False, "error": code}
    # Failed calls still count toward the person's limit (5 in the test window).
    assert env.client.post("/agent", json=CHAT, headers=AUTH).status_code == 429


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


def connect_slack(env):
    env.store.put("slack:user-a", {"token": "xoxb-1", "teamId": "T1", "teamName": "Acme", "connectedAt": 1})
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
    status = env.client.get("/slack/status", headers=AUTH).json()["result"]
    assert status == {"available": True, "connected": False, "revoked": True}
    assert env.store.get("slack:user-a") is None


def test_slack_install_round_trip(env):
    url = env.client.post("/slack/install", headers=AUTH).json()["result"]["url"]
    query = parse_qs(urlparse(url).query)
    assert query["scope"] == ["channels:read,channels:history,channels:join,users:read"]
    assert query["redirect_uri"] == [SETTINGS.slack_redirect_uri]
    env.slack_api.handlers["oauth.v2.access"] = lambda **_: {"ok": True, "access_token": "xoxb-new", "team": {"id": "T9", "name": "Acme"}}
    res = env.client.get("/slack/callback", params={"code": "abc", "state": query["state"][0]}, follow_redirects=False)
    assert res.status_code == 302 and res.headers["location"] == "https://rooted.example/onboarding?slack=connected"
    assert env.store.get("slack:user-a")["token"] == "xoxb-new"


def test_slack_callback_refuses_forged_or_expired_state_and_handles_cancel(env):
    forged = env.client.get("/slack/callback", params={"code": "abc", "state": "eyJ1IjoidXNlci1iIn0.bad"}, follow_redirects=False)
    assert forged.headers["location"].endswith("?slack=expired")
    expired_state = slack.make_state(SETTINGS, "user-a", NOW - 3600)
    expired = env.client.get("/slack/callback", params={"code": "abc", "state": expired_state}, follow_redirects=False)
    assert expired.headers["location"].endswith("?slack=expired")
    cancelled = env.client.get("/slack/callback", params={"error": "access_denied"}, follow_redirects=False)
    assert cancelled.headers["location"].endswith("?slack=cancelled")
    assert env.store.get("slack:user-a") is None


def test_disconnect_revokes_the_token_and_forgets_it(env):
    connect_slack(env)
    assert env.client.post("/slack/disconnect", headers=AUTH).json()["result"] == {"connected": False}
    assert ("auth.revoke", "xoxb-1") in [(m, t) for m, t, _ in env.slack_api.calls]
    assert env.store.get("slack:user-a") is None


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
