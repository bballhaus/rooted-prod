---
name: review-pr
description: Multi-agent code review for the Rooted repo. Sizes the diff into a risk tier, runs the matching specialist reviewers (scope, correctness, security, design) in parallel, verifies and dedupes their findings, and returns one review with a verdict. Use when asked to review a branch, a diff or a PR in this repo, before opening a PR, or from the claude-review CI workflow.
---

# Review a Rooted change

Review the current branch against `main`, or the PR number given in the arguments.

## 1. Get the change

- PR number given: `gh pr view <n> --json title,body,files` and `gh pr diff <n>`.
- Otherwise: `git diff main...HEAD`, `git diff main...HEAD --stat`, and `git log main..HEAD --oneline` for the commit messages.

Find the feature IDs (`F-xx`, `F-R2-xx`, `F-R3-xx`) in the title, body, branch name and commits.

## 2. Pick the tier

Leave out lock files, build output, minified or generated files and snapshots when counting changed lines. Database migrations do count.

- **Full:** more than about 150 changed lines, or any change to auth or sessions, data scope or deletion, Slack or other integrations, LLM prompts or agent context assembly, the database schema or row-level security, `.github/`, `.claude/`, or `SECURITY.md`.
- **Trivial:** only Markdown outside `.claude/`, or 10 changed lines or fewer that touch nothing listed under Full.
- **Lite:** everything else.

| Tier | Reviewers |
|---|---|
| Trivial | scope-reviewer |
| Lite | scope-reviewer, correctness-reviewer, and design-reviewer if UI files changed |
| Full | scope-reviewer, correctness-reviewer, security-reviewer, and design-reviewer if UI files changed |

## 3. Run the reviewers in parallel

Launch the chosen subagents in one message. Give each the same brief: the PR title and body, the feature IDs, the tier, and the diff (or the path of a file you wrote it to, for a large diff). Tell them to read surrounding code as needed. Don't pass your own opinion of the change.

## 4. Verify, dedupe, decide

- For each finding, open the code and check it. Drop it if you can't confirm the failure it describes, or if it's a style nit, speculative, or about code the PR didn't touch.
- Merge findings that describe the same problem. Keep the higher severity.
- Re-rate severity if a reviewer over- or under-called it: critical means a real bug, security or privacy hole, or data loss.
- Verdict: **Request changes** if any critical remains. Otherwise **Approve**, listing warnings to fix or defer. Lean toward approving.

## 5. Report

```markdown
## Agent review: <Approve | Request changes>

**Tier:** <tier> (<n> lines, <reason>) · **Reviewers:** <list> · **Features:** <IDs or none>

### Critical
- `path:line`: problem. Failure: … Fix: …

### Warnings
- …

### Suggestions
- …

<One line on anything the reviewers couldn't check, such as tests that couldn't run.>
```

Leave out empty sections. In CI, post this as the PR comment. Locally, print it, and don't edit any files.
