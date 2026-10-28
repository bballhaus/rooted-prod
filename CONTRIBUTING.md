# Contributing

## Flow

1. Pick or open an issue with its feature IDs (use the "Feature" issue template).
2. Branch from `main`: `<your-name>/F-14-log-decision`. If you're running agents in parallel, use one worktree per branch (`docs/engineering/agent-workflow.md`).
3. Build it, with tests for the feature's acceptance notes (`docs/engineering/testing.md`).
4. Run `/review-pr` in Claude Code and fix the criticals.
5. Open a PR using the template. CI runs the docs checks, the secret scan and the agent review.
6. A teammate reviews and approves. Then squash-merge.

Nobody pushes to `main` directly, and nobody merges their own PR without a teammate's approval.

## Commits and PR titles

[Conventional Commits](https://www.conventionalcommits.org/) with the feature ID as the scope when there is one:

- `feat(F-14): log decision and rationale in one step`
- `fix(F-26): default review date skips past month end`
- `docs: add decision record for the app stack`
- `chore(ci): bump checkout action`

The squash-merge commit uses the PR title, so get the title right.

## Reviewing a teammate's PR

- Read the diff, not just the agent review's summary. Check that the tests would fail if the feature broke.
- Try UI changes in the preview or locally.
- Reply within a day. If you request changes, say exactly what would get your approval.
- Agent findings you disagree with get a short reply saying why.

## Decisions

If a PR makes or depends on a team decision (stack, data source, schema, a scope cut), add a record in `docs/decisions/` from `0000-template.md` in the same PR, and say so in the description.
