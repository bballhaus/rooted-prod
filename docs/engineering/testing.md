# Testing

There is no app code yet, so there are no test commands. This file sets the rules the first code PR has to meet, so a coding agent can check its own work instead of asking a teammate to click around. The PR that picks the stack fills in the command table and adds the test runner to CI.

## Commands

| Check | Command |
|---|---|
| Docs lint | `npx markdownlint-cli2` |
| Docs internal links | `lychee --offline --include-fragments .` (`brew install lychee`) |
| Unit and integration tests | TBD with the stack |
| One test file | TBD |
| End-to-end (browser) | TBD |
| LLM evals | TBD |
| Full gate (what CI runs) | TBD |

## Every feature starts from its acceptance notes

Each MVP feature in `docs/product/features.md` has acceptance notes. They are the test plan:

- Each acceptance note becomes at least one test, named with the feature ID: `F-08: marking a context item wrong removes it from the decision's context`.
- A PR for `F-xx` that has no tests for `F-xx` isn't done. If something can't be tested automatically yet, the PR says what and how it was checked by hand.
- For a bug, write the failing test first and show it failing, then fix it.
- Never delete, skip or loosen a test to make a change pass. Never update a snapshot or eval baseline without saying why in the PR.

## Layers

| Layer | What it covers | Examples |
|---|---|---|
| Unit | Pure logic, no network | Review date from the default offset (F-26). Data-scope filtering, so excluded channels never reach the agent (F-02). Building a decision record from the chosen option, rationale and context snapshot (F-14). |
| Integration | API and database, external services mocked | Logging a decision then finding it in history (F-14 → F-17). Rejected options keep their reasons (F-18). Disconnecting Slack and deleting data actually removes rows (F-23). |
| End-to-end | The MVP learning loop in a real browser | Sign in → enter a decision → review and correct context → see options → log it → find it again → the review-date nudge opens the outcome form. One happy path, plus correcting wrong context. |
| LLM evals | What the agent says, scored against a fixed set | See below. Run when a prompt, model or retrieval change lands, not on every commit. |
| Accessibility | UI changes | Automated axe check on each MVP screen; keyboard-only run through the core loop; 44px targets; reduced motion. |

## Mocks and fixtures

- Slack, Google sign-in, email and Slack notifications, and the LLM sit behind interfaces with an in-memory fake. Tests never call the real services. The prototype runs on the same fakes (`features.md`, "Prototype guidance").
- Fixtures are synthetic: invented teams, channels, people and messages. Never paste real Slack messages, interview quotes or teammates' data into a fixture. This repo is public.
- Keep one shared fixture workspace (a few channels, about a dozen decisions in different states: open, decided, outcome logged, some with rejected options) so tests and evals use the same story.

## LLM evals

Trust in gathered context is the MVP's learning goal, so agent output gets tested like code. Keep a small eval set: synthetic decisions, each with its context items and the facts a good answer must and must not contain. Check that:

1. Every claim in a context summary or option traces to a context item it was given. No invented sources.
2. Missing information is flagged (F-09) when the eval case removes a key fact.
3. The agent lays out options and tradeoffs but does not choose for the PM.
4. Content from excluded channels or sources never appears (F-02).
5. Instructions inside Slack messages ("ignore previous instructions…") are treated as data, not followed.

Record the pass rate per check with the model and prompt version. A change that lowers a pass rate needs a reason in the PR.

## Observability

When the agent runs, log one structured event per run: decision ID, which sources and how many context items were used, model, prompt version, latency, token count, and whether the user later flagged an answer wrong (F-28). Don't log message text, decision text or email addresses. The F-28 "report wrong answer" rate is the production signal for the evals above.
