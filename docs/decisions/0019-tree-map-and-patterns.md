# 0019: The map opens as a tree, Needs you stays open, and patterns come forward from R3

- **Status:** decided
- **Date:** 2026-11-13
- **Decided by:** Shirley (PM)
- **Review date:** 2026-12-02
- **Features:** F-16, F-17, F-19, F-R3-05; supersedes the force-laid Graph view from 0010

## Question

Testing the home map with the PM showed four problems:

- The force-laid Graph opened as a jumble.
- Switching to List hid the Graph and Timeline switches.
- "Color by" only changed a thin stripe, and the colors had no key nearby.
- Trace was a separate toggle nobody understood.

"Needs you" was closed by default, behind an unlabelled icon. Separately, the PM asked for Rooted to find patterns and predict trends, which the plan held for R3 (F-R3-05). What should the map and rail look like, and where does pattern-finding go?

## Options

### Chosen: a layered tree, one view switch, a key on the canvas, an open rail, and a Patterns page

- **Tree layout.** Tree replaces Graph as the default. Each tree of linked decisions reads left to right, and a decision sits one column right of the latest decision it builds on. Trees are named after their thread and stacked, biggest first. Unlinked decisions come last. The layout is pure and deterministic (`treeLayout` in `graphLayout.ts`). Cards can still be dragged, and a control puts them back. Positions dragged in the old Graph are dropped (`rooted-map-pos-v2`).
- **One view switch.** Tree, Timeline and List sit side by side in one switch, and all three are always visible. Grouping shows only for Timeline and List.
- **Color and the key.** A card takes its color whole, as a tint, border and stripe. A key on the canvas holds "Color by", what each color and line means, and the card-details option. Status is still written on every card.
- **Lineage on select.** Picking a decision lights up its lineage, everything it built on and led to, so there's no Trace toggle.
- **Filters.** Filters open as a labelled panel with a shown count, an on-count on the button and "Clear filters".
- **A smaller dock.** The dock keeps only the view switch, grouping and Filters, so it fits beside the rail without wrapping. "Details" moves into the key. The light/dark toggle leaves the dock and stays in the profile menu, so the test that kept the two toggles in step goes with it.
- **Needs you.** The rail is open on wide screens, and the choice is remembered. It has three parts:
  - "Due": outcomes to log and close deadlines, each with its next step.
  - "Decisions to make": the PM's drafts with stage, open questions and deadline, Rooted's suggestions, New decision and the Slack check.
  - "From Rooted": Patterns and finding connections.
- **Patterns (F-R3-05), pulled forward.** A Patterns page sits in the header beside Decisions.
  - **The numbers.** It counts decisions by month, time to decide, outcomes logged and how they turned out, and decisions by goal (`store/patterns.ts`). This is plain counting, with no AI.
  - **What Rooted sees.** On request, a new AI task, `findPatterns`, sends Claude the decisions and those counts. It returns up to six patterns, trends, risks and predictions. Each insight must cite real decisions: two for a pattern, trend or risk, and one for a prediction. The service drops any that don't. Insights are Rooted's (✦), and they're editable, dismissable and reportable (F-08, F-28).
  - **Minimum history.** It needs at least three logged decisions. This minimum is provisional (see Consequences).
  - **Looking again.** It replaces Rooted's insights but keeps the ones the PM edited. An answer that arrives after the workspace changed is dropped.

### Pruned: keep the force graph and tune it

The force layout has no reading direction. Tuning spacing doesn't make a chain of decisions read as a chain.

### Pruned: put patterns inside the map or the agent chat

A chat answer disappears, and the map is already busy. Patterns are a page you come back to, with the evidence linked.

## Consequences

- **Scope.** F-R3-05 is in the build early. The 0005 scope line that trends don't ride along is overridden for this one feature, at the PM's request.
- **Open threshold.** "How much usage do we need to produce trends and patterns?" (features.md §7) stays open. The three-decision minimum is provisional.
- **Deploy.** `findPatterns` runs only after a person redeploys the AI service.

## Outcome

Fill this in on the review date: do PMs open Patterns more than once, and do they report insights as wrong?
