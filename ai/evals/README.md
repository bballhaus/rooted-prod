# Agent evals

Evals score what Rooted's agent actually says, on synthetic data, against the production prompts (`ai/rooted_ai/tasks.py`). They call Claude and cost money, so they run by hand when a prompt, model or retrieval change lands, not in CI. The unit tests in `ai/tests/test_evals.py` cover the harness itself with Claude faked.

## The two evals

| Eval | What it answers | Runner |
|---|---|---|
| Scenarios | Does each agent task do the common job well, and hold up when someone tries to break it? 15 scenarios (6 common, 9 adversarial: prompt injection in Slack and in option text, pressure to decide, system-prompt extraction, role-play jailbreaks, missing facts, a decision that doesn't exist, a quote that doesn't exist, pure chatter), 5 trials each. | `run_scenarios.py`, cases in `scenarios.py` |
| Test 3, feasibility | Does the AI pull accurate decisions from Slack? 50 synthetic channels (`slack_corpus.py`) shaped like Slack API responses, with emoji, links, bots, threads, reactions and lookalike non-decisions, read through Rooted's real Slack reader and the production `spotDecisions` task. | `run_extraction.py` |

Each scenario trial passes only if the call succeeds, every deterministic check passes, and an LLM judge (Claude Opus 5.5, stronger than the Sonnet model under test) passes every criterion. Test 3 has two judges match suggestions to the tagged decisions and rate each summary 1–5, independently, so their agreement (Cohen's κ) can stand in for agreement between human reviewers.

Every rate comes with a 95% interval: Wilson for a pass rate, and a bootstrap over whole scenarios or conversations where trials aren't independent. With small sets the intervals are wide; read a change as real only when they stop overlapping.

## Running

With the key in Modal (no key on your machine):

```bash
python3 -m modal run ai/evals/modal_run.py                      # both, about $10–12
python3 -m modal run ai/evals/modal_run.py --which extraction   # or scenarios
```

Or locally with a key:

```bash
cd ai
ANTHROPIC_API_KEY=... .venv/bin/python -m evals.run_scenarios --trials 5
ANTHROPIC_API_KEY=... .venv/bin/python -m evals.run_extraction
```

Every run stops at `--max-usd` (default 15). Reports land in `ai/evals/reports/` as Markdown to read and JSON with every trial. Commit a report when it backs a decision or a PR claim, and say in the PR why a pass rate moved (`docs/engineering/testing.md`).

## Rules

- Everything is synthetic: the invented startup Brightline and its people. Never put real Slack messages, people or customer data in a scenario or the corpus.
- Test 3's tags use a working definition of a decision (a team choice between real alternatives, made or explicitly pending). That's for this test only; what counts as a decision is still an open team question.
- Don't loosen a check or a criterion to make a run pass. If a check is wrong, fix it in its own commit and say why.
