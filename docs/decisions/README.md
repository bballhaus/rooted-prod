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
| [0007](0007-llm-behind-edge-function.md) | Call the LLM from a Supabase Edge Function, with sample answers as the fallback | Decided 2026-10-31 (provider open) |
| [0008](0008-accents-threads-sign-in.md) | Two restrained accents, thread lanes on the map, a split sign-in page | Decided 2026-10-31 |

## Open decisions

Raise these with the team. Agents don't settle them.

| Decision | Where it stands |
|---|---|
| LLM provider and hosting | Provider not chosen. The path to it is built (0007): set three Edge Function secrets to switch it on. Hosting is still open. |
| MVP context source: Slack or meeting transcripts | Story map picks Slack; the parking lot still asks. |
| What counts as a decision, and the minimum decision record | Parking lot: "answer first." The prototype's AI-suggested decisions are hand-written examples (0005) and don't settle it. |
| Lead story: context gathering or option mapping and scoring | Value proposition and landing page disagree. The prototype shows rough ratings (0004) without settling it. |
| Activation target: 2 decisions by day 7, or 3+ in 2 weeks | Opportunity tree and funnel disagree. |
