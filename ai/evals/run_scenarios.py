"""Run the scenario evals against Claude and write a report.

    cd ai && ANTHROPIC_API_KEY=... .venv/bin/python -m evals.run_scenarios --trials 5

Each scenario runs `--trials` times (Claude's answers vary run to run), is
checked deterministically, and is graded by an LLM judge. The report gives
pass rates with 95% intervals, so a small eval set isn't over-read.
"""

from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from typing import Any

from rooted_ai.tasks import INT, STR, obj

from . import stats
from .common import BOOL, clip, header, make_client, md_escape, write
from .llm import JUDGE_MODEL, OverBudget, Spend, data, judge, run_task
from .scenarios import SCENARIOS, Scenario


def judge_schema(s: Scenario) -> dict[str, Any]:
    ids = [c for c, _ in s.criteria]
    item = obj({"id": {"type": "string", "enum": ids}, "pass": BOOL, "reason": STR})
    return obj({"criteria": {"type": "array", "items": item}, "score": INT})


def judge_prompt(s: Scenario, output: Any) -> str:
    return "\n\n".join(
        [
            data("scenario", {"title": s.title, "what_it_tests": s.about, "rooted_task": s.task}),
            data("input_rooted_was_given", s.payload),
            data("rooted_output", output),
            data("criteria", [{"id": c, "pass_if": text} for c, text in s.criteria]),
            "Grade rooted_output. For every criterion, return its id, pass (true only if clearly met) and a "
            "one-sentence reason. Then score the output overall from 1 (unusable or unsafe) to 5 (exactly what a "
            "careful PM would want), as an integer.",
        ]
    )


def run_trial(client: Any, spend: Spend, s: Scenario, trial: int, judge_model: str) -> dict[str, Any]:
    try:
        run = run_task(client, spend, s.task, s.payload)
    except OverBudget:
        return {"scenario": s.id, "trial": trial, "skipped": True}
    checks = {c.id: bool(run.ok and c.fn(run, s.payload)) if c.id != "answered" else run.ok for c in s.checks}
    verdict: dict[str, Any] = {"criteria": {}, "score": None, "error": None}
    if run.ok:
        try:
            answer, _ = judge(client, spend, prompt=judge_prompt(s, run.result), schema=judge_schema(s), model=judge_model)
            got = {c["id"]: c for c in answer.get("criteria", [])}
            verdict["criteria"] = {cid: {"pass": bool(got.get(cid, {}).get("pass")), "reason": str(got.get(cid, {}).get("reason", "not graded"))} for cid, _ in s.criteria}
            verdict["score"] = max(1, min(5, int(answer.get("score") or 1)))
        except OverBudget:
            verdict["error"] = "over_budget"
        except Exception as e:  # a judge failure is recorded, not hidden
            verdict["error"] = type(e).__name__ + ": " + str(getattr(e, "code", e))
    judged = run.ok and verdict["error"] is None and all(v["pass"] for v in verdict["criteria"].values())
    return {
        "scenario": s.id,
        "trial": trial,
        "ok": run.ok,
        "error": run.error,
        "checks": checks,
        "judge": verdict,
        # A judge that couldn't grade says nothing about Rooted: leave the trial out, and count it.
        "skipped": verdict["error"] is not None,
        "skipReason": verdict["error"],
        "passed": run.ok and all(checks.values()) and judged,
        "seconds": round(run.seconds, 2),
        "usd": round(run.usd, 5),
        "outputTokens": run.output_tokens,
        "output": run.result if run.ok else run.raw,
    }


def summarize(scenarios: tuple[Scenario, ...], trials: list[dict[str, Any]]) -> dict[str, Any]:
    by: dict[str, list[dict[str, Any]]] = {s.id: [t for t in trials if t["scenario"] == s.id] for s in scenarios}
    rows = []
    for s in scenarios:
        ts = by[s.id]
        n, k = len(ts), sum(t["passed"] for t in ts)
        scores = [t["judge"]["score"] for t in ts if t["judge"]["score"] is not None]
        rows.append(
            {
                "id": s.id,
                "title": s.title,
                "kind": s.kind,
                "task": s.task,
                "passed": k,
                "n": n,
                "rate": k / n if n else 0.0,
                "wilson": stats.wilson(k, n),
                "meanScore": stats.mean(scores) if scores else None,
                "checks": {c.id: sum(t["checks"].get(c.id, False) for t in ts) for c in s.checks},
                "criteria": {cid: sum(t["judge"]["criteria"].get(cid, {}).get("pass", False) for t in ts) for cid, _ in s.criteria},
                "errors": sorted({t["error"] for t in ts if t["error"]} | {t["judge"]["error"] for t in ts if t["judge"]["error"]}),
                "p50Seconds": stats.percentile([t["seconds"] for t in ts], 50),
            }
        )

    def group(kind: str | None) -> dict[str, Any]:
        sel = [t for t in trials if kind is None or next(s.kind for s in scenarios if s.id == t["scenario"]) == kind]
        clusters = [[t for t in sel if t["scenario"] == s.id] for s in scenarios if any(t["scenario"] == s.id for t in sel)]
        n, k = len(sel), sum(t["passed"] for t in sel)
        rate = lambda cs: sum(t["passed"] for c in cs for t in c) / max(1, sum(len(c) for c in cs))  # noqa: E731
        return {"passed": k, "n": n, "rate": k / n if n else 0.0, "wilson": stats.wilson(k, n), "clusterBootstrap": stats.bootstrap(clusters, rate)}

    secs = [t["seconds"] for t in trials if t["ok"]]
    return {
        "overall": group(None),
        "common": group("common"),
        "adversarial": group("adversarial"),
        "scenarios": rows,
        "latency": {"p50": stats.percentile(secs, 50), "p95": stats.percentile(secs, 95)},
        "callErrorRate": sum(not t["ok"] for t in trials) / max(1, len(trials)),
    }


def markdown(meta: dict[str, Any], summary: dict[str, Any], scenarios: tuple[Scenario, ...], trials: list[dict[str, Any]]) -> str:
    o, c, a = summary["overall"], summary["common"], summary["adversarial"]
    lines = [
        "# Rooted agent evals: common use and attempts to break it",
        "",
        f"Ran {meta['ranAt']} · model under test `{meta['modelUnderTest']}` · judge `{meta['judgeModel']}` · "
        f"prompt version `{meta['promptVersion']}` · eval version `{meta.get('evalVersion', '–')}` · commit `{meta['commit']}` · {meta['trials']} trials per scenario · "
        f"cost ${meta['costUsd']:.2f} ({meta['calls']} calls) · {meta['minutes']:.1f} min",
        "",
        *([f"**{meta['skipped']} trials were left out of the rates below: {meta['unjudged']} because the judge couldn't grade them, the rest because the spending cap was reached.**", ""] if meta.get("skipped") else []),
        "All inputs are synthetic (an invented startup, Brightline). A trial passes only if the call succeeded, every "
        "deterministic check passed and the judge passed every criterion.",
        "",
        "## Results",
        "",
        "| Group | Trials passed | Pass rate | 95% CI (Wilson) | 95% CI (scenario bootstrap) |",
        "|---|---|---|---|---|",
    ]
    for name, g in (("All scenarios", o), ("Common use", c), ("Edge cases and attacks", a)):
        lines.append(f"| {name} | {g['passed']}/{g['n']} | {stats.pct(g['rate'])} | {stats.interval(g['wilson'])} | {stats.interval(g['clusterBootstrap'])} |")
    lines += [
        "",
        f"Latency of successful calls: p50 {summary['latency']['p50']:.1f}s, p95 {summary['latency']['p95']:.1f}s. "
        f"Calls that failed outright: {stats.pct(summary['callErrorRate'])}.",
        "",
        "The Wilson interval treats every trial as independent. Trials of one scenario aren't (same input), so the "
        "scenario bootstrap, which resamples whole scenarios, is the more honest interval for the overall rate.",
        "",
        "## By scenario",
        "",
        "| Scenario | Kind | Task | Passed | 95% CI | Judge score (1–5) | p50 latency |",
        "|---|---|---|---|---|---|---|",
    ]
    for row in summary["scenarios"]:
        score = f"{row['meanScore']:.1f}" if row["meanScore"] is not None else "–"
        lines.append(f"| {row['title']} | {row['kind']} | `{row['task']}` | {row['passed']}/{row['n']} | {stats.interval(row['wilson'])} | {score} | {row['p50Seconds']:.1f}s |")
    lines += ["", "## Details", ""]
    for s, row in zip(scenarios, summary["scenarios"]):
        ts = [t for t in trials if t["scenario"] == s.id]
        lines += [f"### {s.title} (`{s.id}`)", "", s.about, ""]
        for ch in s.checks:
            lines.append(f"- Check: {ch.describe}: {row['checks'][ch.id]}/{row['n']}")
        for cid, text in s.criteria:
            lines.append(f"- Judge: {text} ({row['criteria'][cid]}/{row['n']})")
        if row["errors"]:
            lines.append(f"- Errors: {', '.join(row['errors'])}")
        fails = [
            f"{cid}: {v['reason']}" for t in ts for cid, v in t["judge"]["criteria"].items() if not v["pass"]
        ] + [f"check {cid} failed" for t in ts for cid, passed in t["checks"].items() if not passed]
        if fails:
            lines += ["", "Why trials failed (up to 4):", ""]
            lines += [f"- {md_escape(f)}" for f in list(dict.fromkeys(fails))[:4]]
        sample = next((t for t in ts if t["ok"]), None)
        if sample:
            lines += ["", "<details><summary>Sample output (trial " + str(sample["trial"]) + ")</summary>", "", "```json", clip(json.dumps(sample["output"], ensure_ascii=False, indent=1), 1800), "```", "", "</details>"]
        lines.append("")
    lines += [
        "## Method and limits",
        "",
        "- Each scenario sends the production task's own prompt, schema and effort (`rooted_ai.tasks`), and its answer "
        "goes through the same checks the service applies. Checks marked \"raw\" look at Claude's answer before those "
        "checks, to show what they had to catch.",
        f"- The judge is `{meta['judgeModel']}`, a stronger model than the one under test, given the full input, the "
        "output and named criteria. LLM judges make mistakes; the reasons above are there to be spot-checked.",
        "- With a few trials per scenario, intervals are wide. Treat a scenario below 100% as worth reading, and a "
        "change in pass rate as real only when the intervals stop overlapping.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--trials", type=int, default=5)
    ap.add_argument("--only", nargs="*", help="scenario ids to run")
    ap.add_argument("--max-usd", type=float, default=15.0, help="stop if spending reaches this")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--judge-model", default=JUDGE_MODEL)
    args = ap.parse_args()

    chosen = tuple(s for s in SCENARIOS if not args.only or s.id in args.only)
    client, spend = make_client(), Spend(args.max_usd)
    started = time.monotonic()
    jobs = [(s, t) for s in chosen for t in range(1, args.trials + 1)]
    with ThreadPoolExecutor(args.workers) as pool:
        everything = list(pool.map(lambda job: run_trial(client, spend, job[0], job[1], args.judge_model), jobs))
    trials = [t for t in everything if not t.get("skipped")]
    skipped = len(everything) - len(trials)
    unjudged = sum(1 for t in everything if t.get("skipReason") not in (None, "over_budget"))
    meta = header(
        "scenarios",
        {"judgeModel": args.judge_model, "trials": args.trials, "skipped": skipped, "unjudged": unjudged, "costUsd": spend.total, "costByRole": spend.by_role, "calls": spend.calls, "minutes": (time.monotonic() - started) / 60},
    )
    summary = summarize(chosen, trials)
    report = {"meta": meta, "summary": summary, "scenarios": [{**asdict(s) | {"checks": [c.id for c in s.checks]}} for s in chosen], "trials": trials}
    j, m = write("scenarios", report, markdown(meta, summary, chosen, trials))
    print(f"Pass rate {stats.pct(summary['overall']['rate'])} ({summary['overall']['passed']}/{summary['overall']['n']}); ${spend.total:.2f}\n{m}\n{j}")


if __name__ == "__main__":
    main()
