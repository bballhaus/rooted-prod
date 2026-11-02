# 0005: Build a working MVP that includes teammates and AI suggestions, on mock data

- **Status:** decided
- **Date:** 2026-10-31
- **Decided by:** Shirley (PM)
- **Review date:** 2026-11-25, after the first round of prototype user tests
- **Features:** F-17, F-19, plus pieces of F-R2-07, F-R2-08 and F-R3-04 (mocked)

## Question

The MVP brief keeps Release 1 to the PM's own data. Should the prototype stay inside that line, or show the team's decisions and what Rooted notices on its own, so testers see the product as one working thing?

## Context

The first prototype read as a set of separate steps, with no sense of a decision history. The PM's direction for the rework: "ignore the MVP staging, we are trying to have a working MVP at the moment." The decision history should be traceable by time, type and who made the call, which needs other people's decisions. Release 2 lists team views (F-R2-07, F-R2-08), and Release 3 lists spotting pending decisions (F-R3-04).

## Options

### Chosen: include teammates, AI tags, AI links and AI-suggested decisions, all on synthetic data

- **Fake teammates.** Six synthetic teammates, named after the people already in the fake Slack corpus, own about half of the 18 seeded decisions. The map can filter and lay out lanes by who decided and by team. A new decision records who makes the call and who to consult. There are no invites, permissions or real accounts.
- **Tags, two kinds.** The PM types their own tags. Rooted suggests some. Suggested tags look different (sage, dashed, ✦) until the PM keeps or removes them.
- **Links between decisions, two kinds.** Links the team makes are solid: a follow-up decision, a decision that builds on another, or a past decision reused as an option. Links Rooted finds are dashed sage until someone connects or dismisses them, and they can be reported as wrong (F-28).
- **Decisions Rooted spotted.** Three synthetic suggestions, each with the Slack evidence behind it, sit in the "Needs you" rail and the inbox. The PM can start one as a decision or dismiss it. Nothing scans Slack: they're seed data.

### Pruned: stay inside Release 1

This would keep only the PM's own decisions and manual entry. Testers would not see the history the product is about, and the map would hold a handful of nodes.

### Pruned: build the real team features

This would need invites, permissions, other people's data and a privacy review (F-R2-01, F-R2-04, F-R2-14). It's too much for a prototype, and it isn't needed to learn whether the history is useful.

## Consequences

- New models: `Teammate`, `Tag`, `DecisionLink`, `SuggestedDecision`. `Decision` gains `ownerId`, `stakeholderIds` and `tags`, and `OptionNode` gains `linkedDecisionId`. Storage moved to `rooted-demo-v2`, so older browser saves fill in missing fields from the seed.
- Every teammate, decision and Slack snippet is synthetic, per `AGENTS.md`.
- This touches two open questions without settling them. AI-suggested decisions assume Rooted can tell what counts as a decision. The suggestions are hand-written examples, and the open question stays open. The tag vocabulary is free text, not a fixed list of decision types.
- The "MVP is the PM's own data" line in `overview.md` and `features.md` no longer describes the prototype. The release plan itself is unchanged. The team should confirm whether the real MVP keeps the line.

## Outcome

Fill this in on the review date: did testers use the team lanes and the AI suggestions, and did they trust the suggested links?
