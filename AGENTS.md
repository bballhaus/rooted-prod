# AGENTS.md

Rooted is an AI decision partner and decision history for startup PMs. It gathers context from where the team already works (Slack first), helps the PM weigh options as a decision tree, logs the choice with its rationale and rejected options, and later asks what happened. The PM makes the call; the agent never decides. Built by Team 10 (Geckos) for Stanford CS 177, Fall 2026. Human-facing intro: `README.md`.

## Status: MVP prototype, Vite + React + TypeScript

- Stack (decision 0003): Vite + React 18 + TypeScript (strict), react-router v6, Vitest + Testing Library (jsdom). Client-only: state lives in one reducer store (`src/store/store.tsx`) persisted to `localStorage`, seeded from synthetic fixtures (`src/data/fixtures.ts`, with a planted demo workspace in `demoFixtures.ts` behind `loadDemo`, 0009). Every agent feature is real (decision 0016): the app calls Rooted's AI service on Modal (`ai/`, Python) through `src/agent/client.ts` with the PM's session, and the service calls Claude. `src/agent/*.ts` build each task's request and map its answer; there are no scripted answers, and a failed call shows an error with a retry and the manual path (`src/components/AiErrorNotice.tsx`). Tests use `src/test/fakeAi.ts` and `ai/tests` fakes; nothing calls Claude in tests. The map uses React Flow (`@xyflow/react`, 0006), with a draggable Tree view, a Timeline view and a List (0010, 0019). Patterns and trends (F-R3-05, pulled forward in 0019) live at `/patterns`: counts in `src/store/patterns.ts`, Rooted's insights from the `findPatterns` task. Light/dark is `data-theme` on `<html>`, set by `src/theme.ts`. Don't add dependencies (UI kits, CSS frameworks, state libraries) without a decision record.
- Layout: `src/types.ts` (models from `features.md` §6), `src/components/` (Layout shell with header, inbox, profile menu and footer; Stepper, Dialog, Popover, ReportWrongAnswer), `src/styles/global.css` (design tokens and base classes), `src/features/<feature>/` (one folder per screen group, with its tests: `dashboard` is the home map and "Needs you" rail, `patterns` the patterns and trends page, `agent` the docked chat, `workspace` the one-page decision), `src/store/dashboard.ts` (status, inbox and link selectors), `src/features/dashboard/graphLayout.ts` (tree layout and lineage), `src/test/render.tsx` (`renderApp`, `renderWithStore`).
- Database and auth are Supabase, project `hxqyudcrlzkiqiwithke` (`docs/decisions/0002-supabase.md`), shared with the landing page. Sign-in is real (0015): an email link, Google or Slack through Supabase Auth, in `src/auth/`; tests use `src/test/fakeAuth.ts`. Tables aren't wired in; decisions live in each browser, and Slack bot tokens live in the AI service's Modal Dict (0017). The site is on Vercel (0011, `vercel.json`). The AI service runs on Modal (`ai/modal_app.py`) with Claude Opus 5.5, reading the Modal secrets `rooted-anthropic`, `rooted-ai-config` and `rooted-slack`; it serves only signed-in Supabase users, limits each person's calls and caps daily spend. A person deploys it (`modal deploy ai/modal_app.py`) and sets secrets; agents don't, and agents don't run it on Modal without asking.
- The public landing page (rooted-stanford.vercel.app) is a separate repo, `rrsudev/CS177-geckos` (Vite + React 18, Supabase signups, PostHog). Its interactive tree is a marketing demo: no ingestion, scoring or integrations stand behind it, and none of its code is in this repo.

## Commands and checks

```bash
npm ci                                             # install
npm run dev                                        # local dev server
npm run typecheck && npm test && npm run build     # full gate
ai/.venv/bin/python -m pytest ai                   # the AI service's tests (python3 -m venv ai/.venv && ai/.venv/bin/pip install -r ai/requirements-dev.txt)
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
- Scope is the working MVP (decision 0005): Slack as the only source and manual decision entry, plus fake teammates, AI tags, AI-found links and AI-suggested decisions on synthetic data. Real team features (invites, permissions, other people's real data), other sources (meeting transcripts, Notion/Gmail) and trends don't ride along unless an issue says so. The one exception is patterns and trends (F-R3-05), which the PM pulled forward in decision 0019.
- Use the product's vocabulary in UI, code and copy: decision, option, branch, prune (reject with a reason), trace, record, outcome, review date. A rejected option is kept with its reason, never deleted. Model names follow `features.md` §6: `User`, `Source`, `Decision`, `ContextItem`, `OptionNode`, `ChatMessage`, `Outcome`, plus `Teammate`, `Tag`, `DecisionLink` and `SuggestedDecision` (0005). What the agent suggests (tags, links, decisions) stays visibly the agent's (sage, ✦) until a person accepts it.
- Tests come from the acceptance notes: each note for a feature you build gets a test named with its ID (`F-08: ...`). For a bug, show the test failing before the fix. Never delete, skip or loosen a test, or update a snapshot or eval baseline, to get a change through. Fixtures are synthetic, never real Slack data.
- Every agent output in the product is editable (F-08) and has a "report wrong answer" action (F-28). Trust in gathered context is the MVP's learning goal, so no AI surface ships without both.
- UI follows `design-language.md`: color through semantic tokens, never raw hex; Bricolage Grotesque only; wine marks the chosen option and nothing else; one 880px breakpoint; touch targets of 44px or more; a reduced-motion fallback for every animation; sentence case.
- A team decision (stack, data source, schema, a scope cut) gets a record in `docs/decisions/`, copied from `0000-template.md`, in the same PR that acts on it.

## Guardrails

- Leave the open questions open: what counts as a decision, Slack or meeting transcripts as the MVP source, which story leads (context gathering or option scoring), and which activation target applies (2 decisions by day 7, or 3+ in 2 weeks). Don't settle one in code or docs. Name it in the PR and ask.
- Don't describe planned features as working. The landing page's pricing (Starter / Team $22 or $18 annual / Enterprise) and integrations (Linear, Jira, Notion) are marketing copy, not requirements.
- Sign-in (0015) and the Slack connection (0017) are real: Rooted's bot reads the public channels a PM allows, on demand, and sends that text to Claude for the request (0016). Drive and nudges are still mocked. Real Slack messages never go into commits, fixtures, test data, screenshots, logs or prompts you write while working on the repo; the only place they travel is the live request path from Slack to Claude.
- This repo is public. Never commit secrets, API keys, `.env` files, a Supabase service-role key, interview transcripts or interviewee names, beta-signup emails, or links to the team's Drive and Miro. Aggregate research numbers are fine (as in `overview.md`); raw research stays in the team Drive.
- Supabase: schema changes are migrations in `supabase/migrations/` (`supabase migration new <name>`), never dashboard edits. Every table gets row-level security limiting rows to their owner, with a test that user A can't read user B's rows. Test against local Supabase (`supabase start`), never the hosted project. Don't run `supabase db push`, `supabase db reset --linked` or SQL against the hosted project; a person applies migrations after merge. Don't touch tables the product didn't create, such as the landing page's `beta_signups`.
- Don't push to `main` or force-push. Every change goes through a PR that a teammate reviews (`CONTRIBUTING.md`).
