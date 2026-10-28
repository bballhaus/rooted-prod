# AGENTS.md

Rooted is an AI decision partner and decision history for startup PMs. It gathers context from where the team already works (Slack first), helps the PM weigh options as a decision tree, logs the choice with its rationale and rejected options, and later asks what happened. The PM makes the call; the agent never decides. Built by Team 10 (Geckos) for Stanford CS 177, Fall 2026. Human-facing intro: `README.md`.

## Status: docs only, no stack yet

- There is no application code, package manifest or test suite yet, so there is nothing to build, test or run. Don't invent commands (`npm test`, `pnpm dev`) or report them as passing.
- The stack is an open decision (`docs/decisions/README.md`). Don't scaffold a framework, add a `package.json`, or pick a database or LLM provider unless the task says to. If a task needs code, stop and ask which stack. The PR that picks it fills the command table in `docs/engineering/testing.md`, copies the commands here, and adds the test run to CI.
- The public landing page (rooted-stanford.vercel.app) is a separate repo, `rrsudev/CS177-geckos` (Vite + React 18, Supabase signups, PostHog). Its interactive tree is a marketing demo: no ingestion, scoring or integrations stand behind it, and none of its code is in this repo.

## Commands and checks (docs only, for now)

```bash
npx markdownlint-cli2                              # lint every Markdown file (.markdownlint-cli2.jsonc)
lychee --offline --include-fragments .             # links between repo files resolve
```

CI (`.github/workflows/`) runs both, plus a gitleaks secret scan and the agent review (`/review-pr`) on every PR. Before saying a change is done, run `/review-pr` and fix any critical findings.

## Layout

- `docs/product/overview.md`: user, problem, core workflow, release boundaries, open questions. Read it before any product change.
- `docs/product/features.md`: the build list. Each feature has a stable ID (`F-01`–`F-28` for the MVP, `F-R2-xx`, `F-R3-xx`) with acceptance notes, plus suggested screens (§6) and data objects.
- `docs/design/design-language.md`: tokens, type, components, voice. Copied from the landing repo; its `src/...` references point there.
- `docs/decisions/`: decision records, the template, and the list of open decisions.
- `docs/engineering/`: `testing.md` (test layers, LLM evals, fixtures; read before writing tests), `code-review.md` (review tiers and reviewers), `agent-workflow.md` (for the humans driving agents).
- `.claude/`: `skills/review-pr` (review coordinator), `agents/*-reviewer.md` (the four specialist reviewers), `hooks/guard.sh` (blocks pushes to `main`, force-pushes, `--no-verify` and `.env` edits). Changes here are Full-tier reviews.
- `CONTRIBUTING.md`: branch, commit and PR rules. `SECURITY.md`: secrets and data handling.

## Conventions

- Name the feature ID in issues, branches, commits and PR titles: branch `<name>/F-14-log-decision`, commit `feat(F-14): log decision and rationale in one step`. Docs-only work uses `docs:`.
- Scope is Release 1 (MVP) unless an issue says otherwise: the PM's own data, Slack as the only source, manual decision entry. Release 2/3 items (team views, meeting transcripts, Notion/Gmail, automatic decision detection, trends) don't ride along with an MVP change.
- Use the product's vocabulary in UI, code and copy: decision, option, branch, prune (reject with a reason), trace, record, outcome, review date. A rejected option is kept with its reason, never deleted. Model names follow `features.md` §6: `User`, `Source`, `Decision`, `ContextItem`, `OptionNode`, `ChatMessage`, `Outcome`.
- Tests come from the acceptance notes: each note for a feature you build gets a test named with its ID (`F-08: ...`). For a bug, show the test failing before the fix. Never delete, skip or loosen a test, or update a snapshot or eval baseline, to get a change through. Fixtures are synthetic, never real Slack data.
- Every agent output in the product is editable (F-08) and has a "report wrong answer" action (F-28). Trust in gathered context is the MVP's learning goal, so no AI surface ships without both.
- UI follows `design-language.md`: color through semantic tokens, never raw hex; Bricolage Grotesque only; wine marks the chosen option and nothing else; one 880px breakpoint; touch targets of 44px or more; a reduced-motion fallback for every animation; sentence case.
- A team decision (stack, data source, schema, a scope cut) gets a record in `docs/decisions/`, copied from `0000-template.md`, in the same PR that acts on it.

## Guardrails

- Leave the open questions open: what counts as a decision, Slack or meeting transcripts as the MVP source, which story leads (context gathering or option scoring), and which activation target applies (2 decisions by day 7, or 3+ in 2 weeks). Don't settle one in code or docs. Name it in the PR and ask.
- Don't describe planned features as working. The landing page's pricing (Starter / Team $22 or $18 annual / Enterprise) and integrations (Linear, Jira, Notion) are marketing copy, not requirements.
- In the prototype, Slack OAuth, Google sign-in and nudges are mocked with sample data unless an issue asks for the real integration. Real Slack messages never go into commits, fixtures, screenshots or prompts.
- This repo is public. Never commit secrets, API keys, `.env` files, a Supabase service-role key, interview transcripts or interviewee names, beta-signup emails, or links to the team's Drive and Miro. Aggregate research numbers are fine (as in `overview.md`); raw research stays in the team Drive.
- Don't push to `main` or force-push. Every change goes through a PR that a teammate reviews (`CONTRIBUTING.md`).
