# 0009: A planted demo workspace, causal links on the map, and recorded outcomes

- **Status:** decided
- **Date:** 2026-10-31
- **Decided by:** Renn (PM); merged by Shirley (PM)
- **Review date:** 2026-11-28, after the next round of prototype user tests
- **Features:** F-16, F-17, F-19; builds on F-10, F-11, F-14
- **Merged:** 2026-11-02, with 0005–0008 (see the merge note)

## Merge note

Written as 0005 on a parallel branch, alongside the records now numbered 0005–0008. When the two branches were merged, these parts survived:

- **Demo mode**: `AppState.demo`, `loadDemo` and `exitDemo`, and the planted forest in `src/data/demoFixtures.ts`, labelled "Demo workspace · sample data" in the header. The switch is in the profile menu, on the onboarding page and on the empty map. The demo's dates were moved six weeks earlier so its logged outcomes sit before today.
- **Model fields**: `metric` (a goal label), `horizon` and `speculative` on `Decision`.
- **The dot stepper**, now the navigation between the sections of 0006's one-page workspace.

These parts were replaced:

- **`builtOn`** became `DecisionLink` records (`kind: 'builds-on'`, `origin: 'user'`, `status: 'accepted'`), built from the demo data when it loads, so they sit beside the links the agent suggests (0005).
- **`Decision.outcome`** became `state.outcomes` (the `Outcome` model in `features.md` §6), with 0006's outcome form on the record page.
- **The left rail shell and separate step routes** were dropped for 0006's header, profile menu and one-page workspace. The old step URLs redirect into it. The "Pruned: collapse every step into a single route" option below is the reasoning this branch had; the team chose the workspace in 0006 because the docked agent sits beside it.
- **`WorkspaceHome` and `/history`** were dropped. The home map (0006, 0010) and its list view replace both.
- **The org decisions** moved into the demo data under the existing fake teammates. "Org" is the map's "Who: Everyone" filter.

## Question

The MVP prototype worked but spread the flow across disconnected pages (frame, brief, options, record, history) and had no way to see how decisions relate. How should the product read as one tool, show the causal effects of many decisions, and demonstrate a full history to a first-time viewer?

## Context

The design language centres on "trace every decision back to its root — the evidence, the people, and the day it was made," and the product docs describe seeing causal effects across many decisions (a later-release goal, F-R3-07). The prototype had none of that connective tissue, and each page felt like a separate tab rather than one workspace. The ask was to centralise the workflow (drawing on Monday.com, Jira and Notion for a persistent shell), make the decision tree the hero, and add a planted demo so the many-node causal view can be shown before a real account has any history.

## Options

### Chosen: a persistent shell, a causal-map home, and a planted demo mode

- **One shell.** A left rail (brand, primary nav, new-decision, demo control, account) wraps every signed-in surface, so the frame → gather → weigh → decide steps read as one workspace. The per-decision steps keep their own routes for deep-linking and are tied together by a dot-based stepper.
- **The map is the main page (`/`).** A new `WorkspaceHome` lays out every decision as a node, left to right, connected by the decisions each one built on. Dot and colour carry state: wine = decided, sage = in progress, dashed berry = a direction to explore. Selecting a node opens an inspector with its reasoning, what it built on, what it led to, and its outcome. The decision list moved to `/history` (a secondary page), with account/settings the other secondary page.
- **Causal links in the model.** `Decision` gains `builtOn` (ids of the decisions a call grew from), `horizon` (`past`/`now`/`future`), `metric` (a short goal label for the node), and `speculative` (a planted future direction).
- **Demo mode.** `AppState.demo` plus `loadDemo`/`exitDemo` actions swap in a self-contained planted forest (`src/data/demoFixtures.ts`): a year of connected, synthetic decisions with reasoning, outcomes, and three speculative "directions to explore" that branch off the live work. It is labelled "Demo workspace — planted sample data" throughout, so it is never mistaken for the PM's own data or for a claim that causal inference is built.
- **Recorded outcomes (F-16).** `Decision.outcome` plus a `logOutcome` action and an outcome section on the record page let a PM record what happened and the metrics that moved; outcomes surface on the map and in history.

### Pruned: collapse every step into a single route

Merging frame/brief/options/record into one page would have broken the deep-linkable, independently tested surfaces for no real gain — a shared shell and stepper already make the flow feel like one place.

### Pruned: generate the causal links automatically

Detecting how decisions relate is explicitly later scope (R3). The links here are authored in the demo data and set by hand; nothing claims automatic causal detection.

## Consequences

- `Decision` and `AppState` gain optional fields; existing data and tests are unaffected (the fields default to absent / `demo: false`).
- The demo's "future directions" and "causal effects" demonstrate a later-release vision (F-R2-09, F-R3-07). They are kept honest by the pervasive "Demo" labelling and by being planted data, not a working capability. The open questions (what counts as a decision, Slack vs. transcripts as the source, which story leads) are untouched.
- Demo content is synthetic: invented company, people, channels and numbers. No real research or Slack data is used.
- The landing page's marketed plans and integrations stay out of the product; demo mode is a demonstration, not a claim that these ship.

## Outcome

Fill this in on the review date: did the map help people trace decisions to their roots, and did demo mode give first-time viewers an accurate feel for the product without overstating what is built?
