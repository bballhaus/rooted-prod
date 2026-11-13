# 0018: Real people start with an empty workspace; the sample company is the demo

- **Status:** decided
- **Date:** 2026-11-13
- **Decided by:** Shirley (PM)
- **Review date:** 2026-12-02
- **Features:** F-17, F-21, F-22; demo mode (0009)

## Question

With real sign-in (0015), real AI (0016) and real Slack (0017), new accounts still opened on a sample company with fake teammates and hand-written "AI" suggestions. What should a real person see first?

## Options

### Chosen: an empty workspace, with the sample company as the labelled demo

- **New accounts.** A new account starts with no decisions and no fake teammates. Slack is ready to connect for real, and Drive is marked "not available yet" (`emptyWorkspaceState()`).
- **The demo.** The sample company stays as "Explore the demo" (0009), labelled sample data. Its AI features call the real AI on its sample messages.
- **No hand-written AI output.** Hand-written AI tags, links and suggested decisions no longer reach anyone. They remain only in test fixtures that exercise the accept, dismiss and report buttons.
- **Saved data.** The saved-data key moves to `rooted-demo-v3`, so sample data saved before real sign-in isn't mistaken for a live Slack connection.
- **Settings.** "Reset sample data" is removed. There's nothing sample to reset to, and the demo is one click away in the profile menu.

### Pruned: keep the sample workspace for everyone

A real PM would see someone else's invented decisions as theirs, and the AI would mix them into real answers.

## Consequences

- First-run screens (empty map, chat starters) now matter more.
- Teammates are just the PM until real team features exist (later scope, 0005).

## Outcome

Fill this in on the review date: did new users find their way to a first decision, or to the demo?
