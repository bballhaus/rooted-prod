# 0001: Set up the repo docs-first, before choosing a stack

- **Status:** decided
- **Date:** 2026-10-28
- **Decided by:** Brooke Ballhaus
- **Review date:** 2026-11-03 (Week 6 prototype due)
- **Features:** none

## Question

`rooted-prod` started empty. Should the first commit scaffold an app, or only the context that people and coding agents need to build one?

## Context

The team builds with coding agents, which do better work with written context: what the product is, its scope, conventions and guardrails. That context was spread across the team Drive, a Miro board and the landing-page repo. No stack has been chosen, and the MVP's data source and decision definition are still open.

## Options

### Chosen: docs only

`AGENTS.md`; product, feature, design and decision docs; contribution and security rules; GitHub templates. Also the parts of quality control that don't depend on a stack: a testing policy, a multi-agent review (`/review-pr` locally and in CI), Claude Code guard hooks, docs lint, a link check and a secret scan. No framework or package manifest.

The stack is the team's call, and committing a scaffold would quietly make it. The docs, review and guardrails are useful whatever the stack turns out to be.

### Pruned: scaffold Next.js + Supabase now

It would give `AGENTS.md` real build, test and lint commands from day one, but it picks the stack for the team before anyone discussed it.

### Pruned: reuse the landing repo's Vite + React setup

That's the fastest start, but it's a static marketing site with no server side for Slack or LLM calls, so most of it would be thrown away.

## Consequences

`AGENTS.md` lists only the docs checks and tells agents to ask before scaffolding. The PR that picks the stack must add a decision record, fill the command table in `docs/engineering/testing.md`, copy the commands into `AGENTS.md`, and add the test run to CI.

## Outcome

To fill in on the review date.
