"""Test 3 (feasibility): does the AI pull accurate decisions out of Slack?

    cd ai && ANTHROPIC_API_KEY=... .venv/bin/python -m evals.run_extraction

Plan, from the team's test card:
- Verify: run v0's extraction over 50 conversations whose decisions were tagged by hand.
- Measure: the share of tagged decisions the AI matches, and how accurate reviewers rate its summaries.
- Right if: 70% or more of decisions match, and reviewers rate the summaries accurate.

Here the conversations are synthetic Slack (evals/slack_corpus.py) with their
decisions tagged as they were generated. They go through Rooted's real Slack
reader (rooted_ai.slack.gather, which drops bots and system messages) and the
production extraction task (spotDecisions). Two LLM judges stand in for the
human reviewers: each matches suggestions to the tags and rates every summary,
independently, so their agreement can be measured the way inter-rater
agreement between people would be.
"""

from __future__ import annotations

import argparse
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from typing import Any

from rooted_ai import slack
from rooted_ai.tasks import INT, STR, obj

from . import stats
from .common import BOOL, header, make_client, md_escape, write
from .llm import JUDGE_MODEL, SECOND_JUDGE_MODEL, OverBudget, Spend, data, judge, run_task
from .slack_corpus import NOW, Conversation, FakeSlackWorkspace, build, human_view

TARGET = 0.70
ACCURATE = 4  # a summary rated 4 or 5 of 5 counts as accurate


def read_like_rooted(conv: Conversation) -> list[dict[str, Any]]:
    """The messages Rooted would send Claude for this channel, via the production reader."""
    return slack.gather(FakeSlackWorkspace(conv), "xoxb-synthetic", [conv.channel_id], clock=lambda: NOW)  # type: ignore[arg-type]


def judge_schema(gold_ids: list[str]) -> dict[str, Any]:
    gid = {"type": "string", "enum": gold_ids} if gold_ids else STR
    return obj(
        {
            "gold": {"type": "array", "items": obj({"goldId": gid, "matchedSuggestion": INT, "reason": STR})},
            "suggestions": {"type": "array", "items": obj({"index": INT, "isRealTeamDecision": BOOL, "accuracy": INT, "reason": STR})},
        }
    )


def judge_prompt(conv: Conversation, suggestions: list[dict[str, Any]]) -> str:
    tags = [{"goldId": g.id, "question": g.question, "status": g.status, "chosen": g.chosen, "summary": g.summary} for g in conv.gold]
    shown = [{"index": i, "question": s["question"], "why": s["why"], "evidence": [e["text"] for e in s["evidence"]]} for i, s in enumerate(suggestions)]
    return "\n\n".join(
        [
            data("slack_channel_as_a_person_sees_it", {"channel": conv.channel, "messages": human_view(conv)}),
            data("decisions_a_person_tagged", tags),
            data("rooted_suggestions", shown),
            "A person read this Slack channel (including thread replies and reactions) and tagged the team decisions "
            "in it. Rooted read the same channel and suggested decisions, each as a question plus why.\n"
            "1. gold: for every tagged decision, give matchedSuggestion, the index of the suggestion about the same "
            "choice, or -1 if none is. Match on the subject of the choice even if the wording or the status differs "
            "(status mistakes are graded under accuracy, not here). Each suggestion matches at most one tag.\n"
            "2. suggestions: for every suggestion, isRealTeamDecision (is it a real team choice in this channel, not "
            "lunch, jokes, sarcasm, personal news or outside news) and accuracy from 1 to 5: how accurately its "
            "question and why describe the situation in the channel as the person sees it. 5: fully right (the right "
            "choice; the right status, meaning what was decided, or that it's still open; and the right reason). "
            "4: right with a minor omission. 3: partly right but misses or garbles one key element, such as the "
            "final choice after a reversal, or calling an open question decided or a decided one open. 2: mostly "
            "wrong. 1: wrong or invented. Grade the substance, not the fact that it is phrased as a question.\n"
            "Give a one-sentence reason for every entry.",
        ]
    )


def judge_one(client: Any, spend: Spend, conv: Conversation, suggestions: list[dict[str, Any]], model: str, role: str) -> dict[str, Any] | None:
    if not suggestions:
        return None  # nothing to rate; every tag is unmatched
    answer, _ = judge(client, spend, prompt=judge_prompt(conv, suggestions), schema=judge_schema([g.id for g in conv.gold]), model=model, role=role)
    n = len(suggestions)
    matches: dict[str, int] = {}
    used: set[int] = set()
    for g in answer.get("gold", []):
        idx = int(g.get("matchedSuggestion", -1))
        if g.get("goldId") in {x.id for x in conv.gold} and 0 <= idx < n and idx not in used:
            matches[g["goldId"]] = idx
            used.add(idx)
    rated: dict[int, dict[str, Any]] = {}
    for s in answer.get("suggestions", []):
        i = int(s.get("index", -1))
        if 0 <= i < n and i not in rated:
            rated[i] = {"real": bool(s.get("isRealTeamDecision")), "accuracy": max(1, min(5, int(s.get("accuracy") or 1))), "reason": str(s.get("reason", ""))}
    reasons = {g.get("goldId"): str(g.get("reason", "")) for g in answer.get("gold", [])}
    return {"matches": matches, "rated": rated, "goldReasons": reasons}


def run_conversation(client: Any, spend: Spend, conv: Conversation, judges: tuple[str, str]) -> dict[str, Any]:
    messages = read_like_rooted(conv)
    run = run_task(client, spend, "spotDecisions", {"messages": messages, "existingDecisions": []})
    suggestions = run.result["suggestions"] if run.ok and run.result else []
    refs = {g.id: {f"{conv.channel_id}:{ts}" for ts in g.key_ts} for g in conv.gold}
    by_refs = {g.id: any(refs[g.id] & {e["ref"] for e in s["evidence"]} for s in suggestions) for g in conv.gold}
    verdicts: dict[str, Any] = {}
    for model, role in zip(judges, ("judgeA", "judgeB")):
        try:
            verdicts[role] = judge_one(client, spend, conv, suggestions, model, role)
        except OverBudget:
            verdicts[role] = {"error": "over_budget"}
        except Exception as e:  # recorded, not hidden
            verdicts[role] = {"error": f"{type(e).__name__}: {getattr(e, 'code', e)}"}
    return {
        "conversation": conv.id,
        "channel": conv.channel,
        "sentToClaude": len(messages),
        "inSlack": len(conv.messages) + sum(len(r) for r in conv.replies.values()),
        "ok": run.ok,
        "error": run.error,
        "seconds": round(run.seconds, 2),
        "suggestions": [{"question": s["question"], "why": s["why"], "refs": [e["ref"] for e in s["evidence"]]} for s in suggestions],
        "gold": [asdict(g) for g in conv.gold],
        "matchedByRefs": by_refs,
        "judgeA": verdicts.get("judgeA"),
        "judgeB": verdicts.get("judgeB"),
    }


def _verdict_of(row: dict[str, Any], role: str) -> dict[str, Any]:
    v = row.get(role)
    if v is None:  # no suggestions: nothing matched, nothing rated
        return {"matches": {}, "rated": {}, "goldReasons": {}}
    return v


def analyse(rows: list[dict[str, Any]]) -> dict[str, Any]:
    # A failed extraction stays in: its tagged decisions count as missed. Only
    # rows a judge couldn't grade, or the spending cap cut short, are left out.
    usable = [r for r in rows if r["error"] != "over_budget" and "error" not in (r["judgeA"] or {}) and "error" not in (r["judgeB"] or {})]

    def recall(rs: list[dict[str, Any]], role: str, only: Any = None) -> tuple[int, int]:
        hit = n = 0
        for r in rs:
            m = _verdict_of(r, role)["matches"]
            for g in r["gold"]:
                if only and not only(g):
                    continue
                n += 1
                hit += g["id"] in m
        return hit, n

    def rate_of(role: str, only: Any = None):
        def f(rs: list[dict[str, Any]]) -> float:
            h, n = recall(rs, role, only)
            return h / n if n else 0.0

        return f

    hit_a, n_gold = recall(usable, "judgeA")
    hit_b, _ = recall(usable, "judgeB")
    hit_vis, n_vis = recall(usable, "judgeA", lambda g: g["visible_to_reader"])
    hit_refs = sum(v for r in usable for v in r["matchedByRefs"].values())

    # Accuracy of the summaries a judge matched to a tagged decision.
    def accuracy(role: str) -> tuple[int, int, list[int]]:
        good = n = 0
        scores: list[int] = []
        for r in usable:
            v = _verdict_of(r, role)
            for idx in v["matches"].values():
                s = v["rated"].get(idx) or v["rated"].get(str(idx))
                if s:
                    n += 1
                    scores.append(s["accuracy"])
                    good += s["accuracy"] >= ACCURATE
        return good, n, scores

    acc_a, acc_n, scores_a = accuracy("judgeA")
    acc_b, acc_nb, scores_b = accuracy("judgeB")

    def acc_rate(rs: list[dict[str, Any]]) -> float:
        good = n = 0
        for r in rs:
            v = _verdict_of(r, "judgeA")
            for idx in v["matches"].values():
                s = v["rated"].get(idx)
                if s:
                    n += 1
                    good += s["accuracy"] >= ACCURATE
        return good / n if n else 0.0

    # Precision: suggestions that are a real tagged decision.
    n_sugg = sum(len(r["suggestions"]) for r in usable)
    matched_sugg = sum(len(_verdict_of(r, "judgeA")["matches"]) for r in usable)
    real_untagged = sum(
        1 for r in usable for i, s in _verdict_of(r, "judgeA")["rated"].items() if s["real"] and i not in _verdict_of(r, "judgeA")["matches"].values()
    )
    noise_only = [r for r in usable if not r["gold"]]
    fp_noise = sum(len(r["suggestions"]) for r in noise_only)

    # Agreement between the two judges, on the same items.
    match_a, match_b = [], []
    for r in usable:
        ma, mb = _verdict_of(r, "judgeA")["matches"], _verdict_of(r, "judgeB")["matches"]
        for g in r["gold"]:
            match_a.append(g["id"] in ma)
            match_b.append(g["id"] in mb)
    sa, sb = [], []
    for r in usable:
        ra, rb = _verdict_of(r, "judgeA")["rated"], _verdict_of(r, "judgeB")["rated"]
        for i in range(len(r["suggestions"])):
            if i in ra and i in rb:
                sa.append(ra[i]["accuracy"])
                sb.append(rb[i]["accuracy"])

    by_style: dict[str, dict[str, Any]] = {}
    styles = sorted({g["style"] for r in usable for g in r["gold"]})
    for st in styles:
        h, n = recall(usable, "judgeA", lambda g, st=st: g["style"] == st)
        good = tot = 0
        for r in usable:
            v = _verdict_of(r, "judgeA")
            for g in r["gold"]:
                if g["style"] == st and g["id"] in v["matches"]:
                    s = v["rated"].get(v["matches"][g["id"]])
                    if s:
                        tot += 1
                        good += s["accuracy"] >= ACCURATE
        by_style[st] = {"matched": h, "n": n, "accurate": good, "rated": tot}

    secs = [r["seconds"] for r in rows if r["ok"]]
    return {
        "conversations": len(rows),
        "usable": len(usable),
        "gold": n_gold,
        "recallA": {"hit": hit_a, "n": n_gold, "rate": hit_a / max(1, n_gold), "wilson": stats.wilson(hit_a, n_gold), "bootstrap": stats.bootstrap(usable, rate_of("judgeA"))},
        "recallB": {"hit": hit_b, "n": n_gold, "rate": hit_b / max(1, n_gold), "wilson": stats.wilson(hit_b, n_gold)},
        "recallVisible": {"hit": hit_vis, "n": n_vis, "rate": hit_vis / max(1, n_vis), "wilson": stats.wilson(hit_vis, n_vis)},
        "recallByRefs": {"hit": hit_refs, "n": n_gold, "rate": hit_refs / max(1, n_gold), "wilson": stats.wilson(hit_refs, n_gold)},
        "accuracyA": {"good": acc_a, "n": acc_n, "rate": acc_a / max(1, acc_n), "wilson": stats.wilson(acc_a, acc_n), "bootstrap": stats.bootstrap(usable, acc_rate), "mean": stats.mean(scores_a)},
        "accuracyB": {"good": acc_b, "n": acc_nb, "rate": acc_b / max(1, acc_nb), "wilson": stats.wilson(acc_b, acc_nb), "mean": stats.mean(scores_b)},
        "precision": {"matched": matched_sugg, "n": n_sugg, "rate": matched_sugg / max(1, n_sugg), "wilson": stats.wilson(matched_sugg, n_sugg), "realButUntagged": real_untagged},
        "noiseOnly": {"conversations": len(noise_only), "suggestions": fp_noise},
        "agreement": {
            "matchKappa": stats.cohen_kappa(match_a, match_b),
            "matchAgree": sum(x == y for x, y in zip(match_a, match_b)) / max(1, len(match_a)),
            "matchItems": len(match_a),
            "accurateKappa": stats.cohen_kappa([x >= ACCURATE for x in sa], [y >= ACCURATE for y in sb]),
            "accurateAgree": sum((x >= ACCURATE) == (y >= ACCURATE) for x, y in zip(sa, sb)) / max(1, len(sa)),
            "scoreWeightedKappa": stats.weighted_kappa(sa, sb),
            "scoreItems": len(sa),
        },
        "byStyle": by_style,
        "latency": {"p50": stats.percentile(secs, 50), "p95": stats.percentile(secs, 95)},
        "messages": {"inSlack": sum(r["inSlack"] for r in rows), "sentToClaude": sum(r["sentToClaude"] for r in rows)},
    }


STYLE_NOTES = {
    "explicit": "PM states the decision outright",
    "consensus": "agreed by +1s and \"sgtm\"",
    "open": "discussed, explicitly not decided yet",
    "reversed": "decided, then changed a day or two later",
    "threaded": "poll whose outcome is only in thread replies",
    "reaction": "approved by ✅ reactions",
    "buried": "one-line \"fyi\" among chatter",
}


def markdown(meta: dict[str, Any], a: dict[str, Any], rows: list[dict[str, Any]]) -> str:
    rec, acc, ag = a["recallA"], a["accuracyA"], a["agreement"]
    h1 = rec["rate"] >= TARGET
    # "With confidence" takes the lower of the two lower bounds: a bootstrap over
    # a few identical conversations can shrink to a single point.
    h1_sure = min(rec["bootstrap"][0], rec["wilson"][0]) >= TARGET
    h2 = acc["rate"] >= TARGET
    h2_sure = min(acc["bootstrap"][0], acc["wilson"][0]) >= TARGET
    trust = ag["accurateKappa"] >= 0.4 and ag["matchKappa"] >= 0.4
    if h1_sure and h2_sure and trust:
        verdict = "Right"
    elif h1 and h2:
        verdict = "Right at the point estimate, not yet with confidence" + ("" if trust else " (and the judges disagree too much to rely on)")
    else:
        verdict = "Not yet"
    lines = [
        "# Test 3 (feasibility): AI pulls accurate decisions from Slack",
        "",
        f"Ran {meta['ranAt']} · extraction `{meta['modelUnderTest']}` via `spotDecisions` (prompt version `{meta['promptVersion']}`, eval version `{meta.get('evalVersion', '–')}`, "
        f"commit `{meta['commit']}`) · judges `{meta['judges'][0]}` (primary) and `{meta['judges'][1]}` · "
        f"{a['conversations']} conversations, {a['gold']} tagged decisions · cost ${meta['costUsd']:.2f} · {meta['minutes']:.1f} min",
        "",
        "## Verdict",
        "",
        f"**{verdict}.** The card says we're right if 70% or more of decisions match and reviewers rate the summaries accurate. "
        "Both rates are measured against this test's working definition of a decision (see Method and limits), which "
        "doesn't settle the team's open question of what counts as one.",
        "",
        "| Hypothesis | Result | 95% CI (bootstrap over conversations) | Met at the point estimate | Met with confidence (bootstrap and Wilson lower bounds above 70%) |",
        "|---|---|---|---|---|",
        f"| ≥70% of tagged decisions matched | {stats.pct(rec['rate'])} ({rec['hit']}/{rec['n']}) | {stats.interval(rec['bootstrap'])} | {'yes' if h1 else 'no'} | {'yes' if h1_sure else 'no'} |",
        f"| ≥70% of matched summaries rated accurate (4–5 of 5) | {stats.pct(acc['rate'])} ({acc['good']}/{acc['n']}) | {stats.interval(acc['bootstrap'])} | {'yes' if h2 else 'no'} | {'yes' if h2_sure else 'no'} |",
        "",
        f"The two judges agree {'well enough to trust' if trust else 'too little to fully trust'} these ratings "
        f"(Cohen's κ {ag['matchKappa']:.2f} on matching, {stats.kappa_label(ag['matchKappa'])}; κ {ag['accurateKappa']:.2f} on "
        f"accurate or not, {stats.kappa_label(ag['accurateKappa'])}).",
        "",
        "## What was measured",
        "",
        "| Measure | Value | 95% CI (Wilson) |",
        "|---|---|---|",
        f"| Tagged decisions matched (primary judge) | {stats.pct(rec['rate'])} ({rec['hit']}/{rec['n']}) | {stats.interval(rec['wilson'])} |",
        f"| Tagged decisions matched (second judge) | {stats.pct(a['recallB']['rate'])} ({a['recallB']['hit']}/{a['recallB']['n']}) | {stats.interval(a['recallB']['wilson'])} |",
        f"| Matched, leaving out decisions settled only in thread replies | {stats.pct(a['recallVisible']['rate'])} ({a['recallVisible']['hit']}/{a['recallVisible']['n']}) | {stats.interval(a['recallVisible']['wilson'])} |",
        f"| Matched by cited message alone (no judge) | {stats.pct(a['recallByRefs']['rate'])} ({a['recallByRefs']['hit']}/{a['recallByRefs']['n']}) | {stats.interval(a['recallByRefs']['wilson'])} |",
        f"| Summaries rated accurate (primary judge) | {stats.pct(acc['rate'])} ({acc['good']}/{acc['n']}), mean {acc['mean']:.2f}/5 | {stats.interval(acc['wilson'])} |",
        f"| Summaries rated accurate (second judge) | {stats.pct(a['accuracyB']['rate'])} ({a['accuracyB']['good']}/{a['accuracyB']['n']}), mean {a['accuracyB']['mean']:.2f}/5 | {stats.interval(a['accuracyB']['wilson'])} |",
        f"| Suggestions that were a tagged decision (precision) | {stats.pct(a['precision']['rate'])} ({a['precision']['matched']}/{a['precision']['n']}) | {stats.interval(a['precision']['wilson'])} |",
        f"| Suggestions the judge called real but no one tagged | {a['precision']['realButUntagged']} | |",
        f"| Suggestions raised in the {a['noiseOnly']['conversations']} conversations with no decision | {a['noiseOnly']['suggestions']} | |",
        "",
        "Inter-rater agreement between the two judges (the stand-in for agreement between human reviewers):",
        "",
        f"- Matching a tag to a suggestion: {stats.pct(ag['matchAgree'])} raw agreement, κ = {ag['matchKappa']:.2f} ({stats.kappa_label(ag['matchKappa'])}), {ag['matchItems']} tags.",
        f"- Accurate or not: {stats.pct(ag['accurateAgree'])} raw agreement, κ = {ag['accurateKappa']:.2f} ({stats.kappa_label(ag['accurateKappa'])}), {ag['scoreItems']} suggestions.",
        f"- The 1–5 scores: quadratic-weighted κ = {ag['scoreWeightedKappa']:.2f} ({stats.kappa_label(ag['scoreWeightedKappa'])}).",
        "",
        "## By kind of decision",
        "",
        "| How the decision shows up in Slack | Matched | Rated accurate |",
        "|---|---|---|",
    ]
    for st, v in a["byStyle"].items():
        lines.append(f"| {st}: {STYLE_NOTES.get(st, '')} | {v['matched']}/{v['n']} ({stats.pct(v['matched'] / max(1, v['n']))}) | {v['accurate']}/{v['rated']} |")
    lines += [
        "",
        f"Rooted's reader sent Claude {a['messages']['sentToClaude']} of the {a['messages']['inSlack']} messages in these channels: it drops bot posts "
        "and join messages, reads replies in up to 25 recent threads, and reads text only, not reactions. "
        f"Extraction latency p50 {a['latency']['p50']:.1f}s, p95 {a['latency']['p95']:.1f}s.",
        "",
        "## Misses and inaccurate summaries (primary judge, up to 10)",
        "",
    ]
    shown = 0
    for r in rows:
        v = r.get("judgeA") or {"matches": {}, "rated": {}, "goldReasons": {}}
        if "error" in v:
            continue
        for g in r["gold"]:
            if shown >= 10:
                break
            if g["id"] not in v["matches"]:
                lines.append(f"- Missed ({g['style']}) in {r['conversation']}: {md_escape(g['summary'])} Judge: {md_escape(v['goldReasons'].get(g['id'], 'no suggestions raised'))}")
                shown += 1
            else:
                s = v["rated"].get(v["matches"][g["id"]])
                if s and s["accuracy"] < ACCURATE:
                    q = r["suggestions"][v["matches"][g["id"]]]
                    lines.append(f"- Inaccurate ({g['style']}, {s['accuracy']}/5) in {r['conversation']}: Rooted said \"{md_escape(q['question'])}\". Judge: {md_escape(s['reason'])}")
                    shown += 1
    errors = [r for r in rows if not r["ok"] or "error" in (r.get("judgeA") or {}) or "error" in (r.get("judgeB") or {})]
    if errors:
        lines += ["", f"{len(errors)} conversations were left out of the rates because a call failed: " + ", ".join(sorted({str(r['error'] or (r.get('judgeA') or {}).get('error') or (r.get('judgeB') or {}).get('error')) for r in errors})) + "."]
    lines += [
        "",
        "## Method and limits",
        "",
        "- The conversations are synthetic, generated from templates (`ai/evals/slack_corpus.py`, seed fixed) and shaped like "
        "Slack API responses: mrkdwn links and mentions, emoji, reactions, giphy, bots, joins, edits, threads, typos and "
        "lookalike non-decisions (lunch, sarcasm, personal news, outside news). Their tags are exact by construction, "
        "which a hand-tagged set of real messages wouldn't be, and template text is more regular than real chat. "
        "Expect real Slack to score lower.",
        "- The tagging rule (a team choice between real alternatives, made or explicitly pending) is this test's working "
        "definition only. What counts as a decision is still an open team question.",
        "- The extraction is the production `spotDecisions` task as it stands: up to 3 choices per read, each with a "
        "question and a why that says whether the team settled it. Check the prompt version above against "
        "`rooted_ai/tasks.py` when comparing reports.",
        "- The judges are LLMs standing in for human reviewers. Their agreement (κ) is reported so the ratings can be "
        "weighed; before relying on this for a decision, have two people rate a sample of the same items and compare.",
        "- Intervals: Wilson treats every decision as independent; the bootstrap resamples whole conversations, since "
        "decisions in one channel aren't independent. The verdict is \"Right\" only when both lower bounds clear 70% and the judges agree at least moderately (κ ≥ 0.4).",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--conversations", type=int, default=50)
    ap.add_argument("--max-usd", type=float, default=15.0)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--judge", default=JUDGE_MODEL)
    ap.add_argument("--second-judge", default=SECOND_JUDGE_MODEL)
    args = ap.parse_args()

    corpus = build(args.conversations)
    client, spend = make_client(), Spend(args.max_usd)
    started = time.monotonic()
    judges = (args.judge, args.second_judge)

    def one(conv: Conversation) -> dict[str, Any]:
        try:
            return run_conversation(client, spend, conv, judges)
        except OverBudget:
            return {"conversation": conv.id, "ok": False, "error": "over_budget", "seconds": 0, "suggestions": [], "gold": [asdict(g) for g in conv.gold], "matchedByRefs": {}, "judgeA": None, "judgeB": None, "inSlack": 0, "sentToClaude": 0}

    with ThreadPoolExecutor(args.workers) as pool:
        rows = list(pool.map(one, corpus))
    # Judges' suggestion indexes come back as ints; keep them that way through JSON.
    meta = header("extraction", {"judges": list(judges), "costUsd": spend.total, "costByRole": spend.by_role, "calls": spend.calls, "minutes": (time.monotonic() - started) / 60})
    analysis = analyse(rows)
    j, m = write("extraction", {"meta": meta, "analysis": analysis, "conversations": rows}, markdown(meta, analysis, rows))
    print(f"Matched {stats.pct(analysis['recallA']['rate'])}, accurate {stats.pct(analysis['accuracyA']['rate'])}; ${spend.total:.2f}\n{m}\n{j}")


if __name__ == "__main__":
    main()
