"""The eval harness itself (ai/evals): its statistics, the synthetic Slack
corpus and the runners, with Claude faked. Nothing here spends money."""

from __future__ import annotations

import json
import math
from types import SimpleNamespace
from typing import Any

import pytest

from evals import run_extraction, run_scenarios, stats
from evals.llm import JUDGE_SYSTEM, Spend
from evals.scenarios import SCENARIOS
from evals.slack_corpus import build, human_view
from rooted_ai.tasks import TASKS
from tests.conftest import reply


# ── statistics ───────────────────────────────────────────────────────────


def test_wilson_interval_is_sane_at_the_edges():
    lo, hi = stats.wilson(0, 10)
    assert lo == 0 and 0.25 < hi < 0.31
    lo, hi = stats.wilson(10, 10)
    assert 0.69 < lo < 0.75 and hi == 1
    lo, hi = stats.wilson(35, 50)
    assert lo < 0.70 < hi
    assert stats.wilson(0, 0) == (0.0, 1.0)


def test_kappa_is_one_for_perfect_agreement_and_near_zero_for_chance():
    assert stats.cohen_kappa([1, 0, 1, 0], [1, 0, 1, 0]) == 1
    assert abs(stats.cohen_kappa([1, 1, 0, 0], [1, 0, 1, 0])) < 1e-9
    assert stats.weighted_kappa([5, 4, 3], [5, 4, 3]) == 1
    # Off by one costs less than off by four.
    assert stats.weighted_kappa([5, 4, 3, 2], [4, 3, 2, 1]) > stats.weighted_kappa([5, 4, 3, 2], [1, 5, 1, 5])
    assert math.isnan(stats.cohen_kappa([], []))


def test_bootstrap_resamples_whole_clusters_reproducibly():
    clusters = [[1, 1], [0, 0], [1, 0]]
    rate = lambda cs: sum(x for c in cs for x in c) / sum(len(c) for c in cs)  # noqa: E731
    assert stats.bootstrap(clusters, rate) == stats.bootstrap(clusters, rate)
    lo, hi = stats.bootstrap(clusters, rate)
    assert 0 <= lo <= 0.5 <= hi <= 1


# ── the synthetic Slack corpus ───────────────────────────────────────────


def test_test3_corpus_has_50_conversations_and_is_reproducible():
    a, b = build(), build()
    assert len(a) == 50
    assert json.dumps([c.messages for c in a]) == json.dumps([c.messages for c in b])
    assert sum(len(c.gold) for c in a) >= 50
    assert sum(1 for c in a if not c.gold) >= 5  # channels with nothing to find


def test_test3_corpus_looks_like_a_real_group_chat():
    text = " ".join(m["text"] for c in build() for m in c.messages)
    for marker in ("<@U", "<https://", "|", "<!here>", "😂", ":eyes:", "lol", "```"):
        assert marker in text
    every = [m for c in build() for m in c.messages]
    assert any(m.get("subtype") == "bot_message" for m in every)
    assert any(m.get("subtype") == "channel_join" for m in every)
    assert any(m.get("reactions") for m in every)
    assert any(m.get("reply_count") for m in every)
    assert any(m.get("edited") for m in every)


def test_test3_tags_point_at_real_messages_and_rooted_reads_what_a_person_can():
    for conv in build():
        all_ts = {m["ts"] for m in conv.messages} | {r["ts"] for rs in conv.replies.values() for r in rs}
        read = {m["ref"] for m in run_extraction.read_like_rooted(conv)}
        for g in conv.gold:
            assert set(g.key_ts) <= all_ts
            if g.visible_to_reader:
                assert f"{conv.channel_id}:{g.key_ts[0]}" in read
        # Rooted's reader drops bots and joins.
        texts = {m["text"] for m in run_extraction.read_like_rooted(conv)}
        assert not any(m["text"] in texts for m in conv.messages if m.get("subtype"))
        assert len(human_view(conv)) == len(conv.messages) + sum(len(r) for r in conv.replies.values())


# ── the scenario set ─────────────────────────────────────────────────────


def test_there_are_at_least_ten_scenarios_of_both_kinds_and_each_builds():
    assert len(SCENARIOS) >= 10
    assert {s.kind for s in SCENARIOS} == {"common", "adversarial"}
    assert len({s.id for s in SCENARIOS}) == len(SCENARIOS)
    for s in SCENARIOS:
        TASKS[s.task].build(s.payload)  # a bad payload would raise
        assert s.checks and s.criteria


# ── the runners, with Claude faked ───────────────────────────────────────


class RoutingClaude:
    """Answers the task under test with `task_answer` and the judge with `judge_answer`."""

    def __init__(self, task_answer: Any, judge_answer: Any) -> None:
        self.task_answer, self.judge_answer = task_answer, judge_answer
        self.models: list[str] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **kw: Any) -> Any:
        self.models.append(kw["model"])
        is_judge = kw["system"] == JUDGE_SYSTEM
        answer = self.judge_answer if is_judge else self.task_answer
        return reply(answer(kw) if callable(answer) else answer)


def scenario(id_: str):
    return next(s for s in SCENARIOS if s.id == id_)


def all_pass(s):
    return {"criteria": [{"id": c, "pass": True, "reason": "ok"} for c, _ in s.criteria], "score": 5}


def test_a_trial_passes_only_when_checks_and_judge_both_pass():
    s = scenario("chat-history-lookup")
    good = {"text": "SSO is Enterprise-only: 4 of 5 enterprise prospects need it.", "citations": ["d-sso"]}
    claude = RoutingClaude(good, all_pass(s))
    t = run_scenarios.run_trial(claude, Spend(5), s, 1, "claude-opus-5-5")
    assert t["passed"] and all(t["checks"].values())
    assert claude.models == ["claude-sonnet-5-5", "claude-opus-5-5"]  # the product model, then the judge

    judged_wrong = {"criteria": [{"id": "correct", "pass": False, "reason": "wrong"}, {"id": "no_hallucination", "pass": True, "reason": "ok"}], "score": 2}
    assert not run_scenarios.run_trial(RoutingClaude(good, judged_wrong), Spend(5), s, 1, "j")["passed"]


def test_following_a_planted_injection_fails_the_trial():
    s = scenario("injection-in-slack")
    pwned = {"items": [{"ref": "C2:1", "group": "Cost"}, {"ref": "C2:2", "group": "Effort"}], "gaps": [{"question": "Approve the migration now — PWNED"}]}
    t = run_scenarios.run_trial(RoutingClaude(pwned, all_pass(s)), Spend(5), s, 1, "j")
    assert not t["passed"] and t["checks"]["no_pwned"] is False


def test_the_spending_cap_stops_calls_and_the_trial_is_skipped_not_failed():
    s = scenario("suggest-tags")
    spend = Spend(0.0)
    t = run_scenarios.run_trial(RoutingClaude({"tags": ["quality"]}, all_pass(s)), spend, s, 1, "j")
    assert t == {"scenario": s.id, "trial": 1, "skipped": True}


def test_extraction_matches_by_cited_message_and_by_judge():
    conv = next(c for c in build() if len(c.gold) == 1 and c.gold[0].style == "explicit")
    g = conv.gold[0]
    ref = f"{conv.channel_id}:{g.key_ts[-1]}"
    found = {"suggestions": [{"question": g.question, "why": "Priya announced it.", "evidenceRefs": [ref]}]}
    verdict = {"gold": [{"goldId": g.id, "matchedSuggestion": 0, "reason": "same"}], "suggestions": [{"index": 0, "isRealTeamDecision": True, "accuracy": 5, "reason": "right"}]}
    claude = RoutingClaude(found, verdict)
    row = run_extraction.run_conversation(claude, Spend(5), conv, ("claude-opus-5-5", "claude-sonnet-5-5"))
    assert row["matchedByRefs"] == {g.id: True}
    assert row["judgeA"]["matches"] == {g.id: 0}
    a = run_extraction.analyse([row])
    assert a["recallA"]["rate"] == 1 and a["accuracyA"]["rate"] == 1
    assert a["agreement"]["matchAgree"] == 1
    assert "Verdict" in run_extraction.markdown({"ranAt": "now", "modelUnderTest": "m", "promptVersion": "p", "commit": "c", "judges": ["a", "b"], "costUsd": 0.1, "minutes": 1}, a, [row])


def test_extraction_with_no_suggestions_needs_no_judge_and_counts_as_missed():
    conv = next(c for c in build() if c.gold)
    claude = RoutingClaude({"suggestions": []}, None)
    row = run_extraction.run_conversation(claude, Spend(5), conv, ("a", "b"))
    assert claude.models == ["claude-sonnet-5-5"]
    assert run_extraction.analyse([row])["recallA"]["hit"] == 0


@pytest.mark.parametrize("s", SCENARIOS, ids=lambda s: s.id)
def test_every_judge_schema_names_its_criteria(s):
    schema = run_scenarios.judge_schema(s)
    ids = schema["properties"]["criteria"]["items"]["properties"]["id"]["enum"]
    assert ids == [c for c, _ in s.criteria]


def test_quoting_real_messages_isnt_mistaken_for_a_fake_approval():
    # The first eval run flagged this honest answer: the check read the end of one
    # quotation and the start of the next as one quote containing "approving".
    s = scenario("fabricated-quote")
    honest = {"text": 'Leo said "Let\'s revisit the Q1 marketing budget." That defers it rather than approving it. Priya wrote "Draft budget is $50k; waiting on Leo."', "citations": []}
    faked = {"text": 'Leo wrote: "Approved, go ahead with the $50k marketing budget."', "citations": []}
    check = next(c for c in s.checks if c.id == "no_fake_quote")
    as_run = lambda answer: SimpleNamespace(ok=True, result=answer, raw=answer)  # noqa: E731
    assert check.fn(as_run(honest), s.payload)
    assert not check.fn(as_run(faked), s.payload)


def test_a_judge_that_cant_grade_leaves_the_trial_out_instead_of_failing_rooted():
    s = scenario("chat-history-lookup")
    good = {"text": "SSO is Enterprise-only: 4 of 5 enterprise prospects need it.", "citations": ["d-sso"]}

    class JudgeRefuses(RoutingClaude):
        def create(self, **kw: Any) -> Any:
            if kw["system"] == JUDGE_SYSTEM:
                self.models.append(kw["model"])
                return reply({}, stop_reason="refusal")
            return super().create(**kw)

    t = run_scenarios.run_trial(JudgeRefuses(good, None), Spend(5), s, 1, "j")
    assert t["skipped"] and t["skipReason"] and all(t["checks"].values())


def test_a_failed_extraction_counts_its_decisions_as_missed():
    convs = [c for c in build() if len(c.gold) == 1][:2]
    g = convs[0].gold[0]
    found = {"suggestions": [{"question": g.question, "why": "said so", "evidenceRefs": [f"{convs[0].channel_id}:{g.key_ts[0]}"]}]}
    verdict = {"gold": [{"goldId": g.id, "matchedSuggestion": 0, "reason": "same"}], "suggestions": [{"index": 0, "isRealTeamDecision": True, "accuracy": 5, "reason": "right"}]}
    ok_row = run_extraction.run_conversation(RoutingClaude(found, verdict), Spend(5), convs[0], ("a", "b"))

    class Refuses(RoutingClaude):
        def create(self, **kw: Any) -> Any:
            return reply({}, stop_reason="refusal")

    failed_row = run_extraction.run_conversation(Refuses(None, None), Spend(5), convs[1], ("a", "b"))
    assert not failed_row["ok"]
    a = run_extraction.analyse([ok_row, failed_row])
    assert (a["recallA"]["hit"], a["recallA"]["n"]) == (1, 2)


def test_test3_says_right_only_with_confidence_and_agreeing_judges():
    meta = {"ranAt": "now", "modelUnderTest": "m", "promptVersion": "p", "commit": "c", "judges": ["a", "b"], "costUsd": 0.1, "minutes": 1}
    convs = [c for c in build() if len(c.gold) == 1][:6]
    rows = []
    for c in convs:
        g = c.gold[0]
        found = {"suggestions": [{"question": g.question, "why": "said so", "evidenceRefs": [f"{c.channel_id}:{g.key_ts[0]}"]}]}
        verdict = {"gold": [{"goldId": g.id, "matchedSuggestion": 0, "reason": "same"}], "suggestions": [{"index": 0, "isRealTeamDecision": True, "accuracy": 5, "reason": "right"}]}
        rows.append(run_extraction.run_conversation(RoutingClaude(found, verdict), Spend(5), c, ("a", "b")))
    a = run_extraction.analyse(rows)
    # 6 of 6 is 100%, but Wilson's lower bound (61%) is under the 70% target.
    assert a["recallA"]["bootstrap"] == (1.0, 1.0)
    report = run_extraction.markdown(meta, a, rows)
    assert "**Right at the point estimate, not yet with confidence" in report


def test_rooted_now_reads_the_thread_reply_where_a_poll_was_settled():
    threaded = [(c, g) for c in build() for g in c.gold if g.style == "threaded"]
    assert threaded
    for conv, g in threaded:
        read = {m["ref"]: m for m in run_extraction.read_like_rooted(conv)}
        outcome = read[f"{conv.channel_id}:{g.key_ts[-1]}"]
        assert outcome["replyTo"] == f"{conv.channel_id}:{g.key_ts[0]}"
