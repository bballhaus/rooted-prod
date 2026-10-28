# Code review

Agents write most of the code, so review is where it can go wrong. Every PR gets an automated multi-agent review, then a human review. The agent review catches what it can; the human owns the merge.

## How it works

`/review-pr` (`.claude/skills/review-pr/SKILL.md`) is a coordinator. It sizes up the diff, sends it to the specialist reviewers that apply, checks each finding against the code, removes duplicates, and returns one review with a verdict.

| Reviewer | Looks for | Model | Agent file |
|---|---|---|---|
| Scope | Change matches its feature IDs and stays in the MVP; doesn't settle an open question; doesn't claim planned features work | Sonnet | `.claude/agents/scope-reviewer.md` |
| Correctness | Logic bugs, missing or weak tests for the feature's acceptance notes, unhandled failures (LLM, Slack, network) | Opus | `.claude/agents/correctness-reviewer.md` |
| Security and privacy | Secrets, real user data in the repo, data-scope leaks across users or excluded channels, Supabase tables without row-level security, prompt injection from Slack content, OAuth scopes | Opus | `.claude/agents/security-reviewer.md` |
| Design | Tokens instead of raw hex, accessibility, Rooted's vocabulary and voice. Only for UI changes. | Sonnet | `.claude/agents/design-reviewer.md` |

Each reviewer runs as its own subagent on the model in its file's `model:` field, so the cheaper model handles the pattern checks and the stronger one handles bugs and security. The coordinator runs on the session's default model. All of them are Claude models; see "Use a different model to review than to write" below.

### Risk tiers

The coordinator picks a tier before spending tokens. Lock files, build output and other generated files don't count toward size.

| Tier | When | Reviewers |
|---|---|---|
| Trivial | Docs only, or 10 lines or fewer | Scope |
| Lite | Up to about 150 lines, nothing sensitive | Scope, correctness, plus design if UI changed |
| Full | Larger, or touches anything sensitive: auth, data scope or deletion, Slack or other integrations, LLM prompts, the database schema, CI, or `.claude/` | All four |

### Findings

Each finding has a severity, a file and line, and a concrete failure: what input or state goes wrong, and how.

- **Critical:** blocks the merge. A real bug, a security or privacy hole, or data loss.
- **Warning:** should be fixed in this PR, or explicitly deferred with a reason.
- **Suggestion:** optional.

The verdict leans toward approval. Style nits that a linter could catch, speculative "might be a problem" items, and requests for unrelated refactors get dropped.

## When each check runs

| Check | Local commit | Push to a PR branch | Push to `main` |
|---|---|---|---|
| Guard hook (`.claude/hooks/guard.sh`) | Before every command a Claude Code agent runs | n/a | n/a |
| Docs lint and link check (`docs.yml`) | No | Yes | Yes |
| Secret scan (`secrets.yml`) | No | Yes | Yes |
| Agent review (`claude-review.yml`) | No | Yes, on open, each push, reopen and ready-for-review; drafts skip | No (merges already passed review) |

Nothing runs on a local `git commit` yet. The repo has no git pre-commit hooks until the stack adds a linter.

## Running it

- **Locally, before opening a PR:** in Claude Code, run `/review-pr`. It reviews your branch against `main`. Fix the criticals, then open the PR.
- **On every PR:** `.github/workflows/claude-review.yml` runs the same skill and posts one sticky comment. It needs a repo secret, `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions). Without it, the job skips with a notice. It doesn't run on PRs from forks, which don't get secrets.
- **A human approves every PR.** Read the diff, not just the agent's summary. If you disagree with a finding, reply on the PR saying why. Don't silently ignore it.

## Use a different model to review than to write

A reviewer from the same model family tends to share the author's blind spots. If a change was written mostly with Claude, also get a review from a different model family (Codex's `/review`, CodeRabbit, or Greptile) before merging Full-tier PRs. Say in the PR which tools wrote and reviewed it.

## Improving the reviewers

When a bug gets past review, add it to the reviewer that should have caught it, as a concrete "flag this" line. When a reviewer keeps raising noise, add a "don't flag" line. Keep the bugs that got past review as an eval set for the reviewers.
