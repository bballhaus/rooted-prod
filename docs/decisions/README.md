# Decisions

Rooted is a decision record, so the team keeps its own here. One file per decision, numbered in order: `0001-short-name.md`, copied from `0000-template.md`. Write the record in the PR that acts on the decision. Don't rewrite a decided record; supersede it with a new one and link back.

## Records

| # | Decision | Status |
|---|---|---|
| [0001](0001-docs-first-repo.md) | Set up the repo docs-first, before choosing a stack | Decided 2026-10-28 |
| [0002](0002-supabase.md) | Use Supabase for the database and auth | Decided 2026-10-28 |
| [0003](0003-vite-react-prototype.md) | Vite + React + TypeScript for the MVP prototype | Decided 2026-10-28 |

## Open decisions

Raise these with the team. Agents don't settle them.

| Decision | Where it stands |
|---|---|
| LLM provider and hosting | Not chosen. The prototype is Vite + React (0003) with a mocked agent; database and auth are Supabase (0002). |
| MVP context source: Slack or meeting transcripts | Story map picks Slack; the parking lot still asks. |
| What counts as a decision, and the minimum decision record | Parking lot: "answer first." Needed before the `Decision` model is built. |
| Lead story: context gathering or option mapping and scoring | Value proposition and landing page disagree. |
| Activation target: 2 decisions by day 7, or 3+ in 2 weeks | Opportunity tree and funnel disagree. |
