# Working with coding agents

How the team uses Claude Code, Codex, Cursor and similar tools on this repo. `AGENTS.md` is what the agent reads; this file is for the people driving it.

## One feature per session

Start each session from one issue with one or two feature IDs. "Implement F-07 and F-08" works because `features.md` gives the agent the acceptance notes. A vague prompt like "build the context screen" invites scope creep.

## Research, plan, then build

1. **Research:** have the agent read the feature's rows in `features.md`, the relevant part of `overview.md`, and the code it will touch. Ask it what's unclear.
2. **Plan:** ask for a plan before code: files, data changes, the tests it will write (from the acceptance notes), and anything that touches an open question. Correct the plan. That's cheaper than correcting the code.
3. **Implement and test:** the agent writes the tests first or alongside, and runs the full gate itself before saying it's done.
4. **Review:** run `/review-pr`, fix what it finds, then open the PR and request a teammate.

If the agent hits an open question (`docs/decisions/README.md`), it should stop and ask, and you should take it to the team rather than let the agent decide.

## Parallel agents

Run each agent in its own git worktree, so two agents never edit the same checkout:

```bash
git worktree add -b brooke/F-14-log-decision ../rooted-F-14 main
```

Remove it when the PR merges: `git worktree remove ../rooted-F-14`. Worktrees still share local ports and any local database, so give parallel runs different ports.

## Before you open a PR

- The PR title has the feature ID and a Conventional Commit type: `feat(F-14): log decision and rationale in one step`.
- Tests for the acceptance notes exist and pass.
- `/review-pr` has no open criticals.
- You've read the whole diff yourself and can explain every line. If you can't, don't open the PR yet.
- If the agent made or relied on a team decision, there's a record in `docs/decisions/`.

## Keep AGENTS.md honest

When an agent gets something wrong because the context was missing or misleading, fix `AGENTS.md` (or the doc it points to) in the same PR. Keep it about a page: it loads into every session, so every line should be specific to this repo.
