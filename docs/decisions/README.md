# Decisions

Rooted is a decision record, so the team keeps its own here. One file per decision, numbered in order: `0001-short-name.md`, copied from `0000-template.md`. Write the record in the PR that acts on the decision. Don't rewrite a decided record; supersede it with a new one and link back.

## Records

| # | Decision | Status |
|---|---|---|
| [0001](0001-docs-first-repo.md) | Set up the repo docs-first, before choosing a stack | Decided 2026-10-28 |
| [0002](0002-supabase.md) | Use Supabase for the database and auth | Decided 2026-10-28 |
| [0003](0003-vite-react-prototype.md) | Vite + React + TypeScript for the MVP prototype | Decided 2026-10-28 |
| [0004](0004-option-tree-graph.md) | Show options as a tree graph with sub-options, rough ratings and linked decisions | Decided 2026-10-28 |
| [0005](0005-working-mvp-scope.md) | Build a working MVP that includes teammates and AI suggestions, on mock data | Decided 2026-10-31 |
| [0006](0006-home-map-and-workspace.md) | Decision map as home; think decisions through in one workspace beside the agent | Decided 2026-10-31 |
| [0007](0007-llm-behind-edge-function.md) | Call the LLM from a Supabase Edge Function, with sample answers as the fallback | Superseded by 0016 |
| [0008](0008-accents-threads-sign-in.md) | Two restrained accents, thread lanes on the map, a split sign-in page | Decided 2026-10-31 |
| [0009](0009-demo-mode-and-outcomes.md) | A planted demo workspace, causal links on the map, and recorded outcomes | Decided 2026-10-31, merged 2026-11-02 |
| [0010](0010-interactive-canvas-and-theme.md) | A draggable, traceable graph view of the map, and a light/dark toggle | Decided 2026-10-31, merged 2026-11-02; graph view superseded by 0019 |
| [0011](0011-host-on-vercel.md) | Host the prototype on Vercel as a static single-page app | Decided 2026-11-02 |
| [0012](0012-workspace-canvas-surface.md) | A clean white workspace surface for the home canvas | Decided 2026-11-02 |
| [0013](0013-light-theme-default.md) | Light is the default theme, not the OS setting | Decided 2026-11-02 |
| [0014](0014-wine-app-bar.md) | The top app bar is a wine surface | Decided 2026-11-02 |
| [0015](0015-real-sign-in.md) | Real sign-in with Supabase Auth: email link, Google and Slack | Decided 2026-11-11 |
| [0016](0016-ai-on-modal-with-claude.md) | Run the agent on Modal, calling Claude, with no scripted answers | Decided 2026-11-13 (supersedes 0007) |
| [0017](0017-real-slack-connection.md) | Connect Slack for real, reading public channels on the server | Decided 2026-11-13 |
| [0018](0018-empty-workspace-for-real-users.md) | Real people start with an empty workspace; the sample company is the demo | Decided 2026-11-13 |
| [0019](0019-tree-map-and-patterns.md) | The map opens as a tree, Needs you stays open, and patterns come forward from R3 | Decided 2026-11-13 |
| [0020](0020-sonnet-for-the-agent.md) | Run the agent on Claude Sonnet 5.5, not Opus 5.5 | Decided 2026-11-13 (supersedes 0016's model choice) |

## Open decisions

Raise these with the team. Agents don't settle them.

| Decision | Where it stands |
|---|---|
| Revisit the one-model choice | 0020 moved every task to Claude Sonnet 5.5 for speed. Whether light tasks (tags, chat) should run on Haiku 5.5 is still open; decide with quality numbers. |
| MVP context source: Slack or meeting transcripts | Story map picks Slack; the parking lot still asks. |
| What counts as a decision, and the minimum decision record | Parking lot: "answer first." Spotting decisions in Slack (0016) uses a provisional, neutral prompt ("choices the team seems to be facing", up to 3) that doesn't settle it. |
| Consent from teammates whose Slack messages Rooted reads | Rooted reads only public channels the installing PM allows, and a workspace admin may have to approve the app (0017). Colleagues aren't asked or told yet. Decide before outside testers. |
| Lead story: context gathering or option mapping and scoring | Value proposition and landing page disagree. The prototype shows rough ratings (0004) without settling it. |
| Activation target: 2 decisions by day 7, or 3+ in 2 weeks | Opportunity tree and funnel disagree. |
