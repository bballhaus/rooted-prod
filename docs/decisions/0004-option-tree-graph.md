# 0004: Show options as a tree graph with sub-options, rough ratings and linked decisions

- **Status:** decided
- **Date:** 2026-10-28
- **Decided by:** Brooke (PM)
- **Review date:** 2026-11-25, after the first round of prototype user tests
- **Features:** F-10, F-11, F-14, F-15, F-18

## Question

How should the options step show the branches a PM can take: flat cards, or a literal decision tree, and what should each node carry?

## Context

F-10 asks for "a decision tree of options/sub-options" and F-11 for "a visual tree/cards view". The first prototype showed only flat, top-level option cards. The PM asked for a literal tree graph of decision nodes "like many dimensions" and, when asked what that meant, picked all three readings below.

## Options

### Chosen: tree graph above the cards, with all three dimensions

- **Deep branches.** Any option can be branched out into sub-options, several levels deep. Each level splits along a different dimension: rollout, then timing, then audience, then how to judge it. Any node can be chosen. Logging keeps the chosen node's parents and sub-options, asks for a reason for each alternative, and prunes options under an alternative along with it. The log dialog shows them before logging.
- **Several rough ratings per node.** Each option carries 1–5 ratings for impact, effort, risk and evidence (`OptionNode.criteria`) next to the existing rough score. The agent drafts them, and the PM can edit them (F-08).
- **Linked decisions.** Past decisions that the evidence brief cited appear as dashed nodes feeding into the decision, linking to their records.

The graph sits above the cards. Picking a node shows its level as cards, which keep editing, pruning, choosing, evidence and "report wrong answer".

### Pruned: tree only, no cards

The graph alone would hold all actions on small nodes, which is harder to use with a keyboard and on phones. Cards stay for detail and accessibility.

### Pruned: one dimension only

The PM asked for all three.

## Consequences

- `OptionNode` gains an optional `criteria` field, and sub-options use the existing `parentId`.
- The rough ratings lean toward the "option mapping and scoring" side of the open lead-story question. That question stays open: the ratings are labelled rough, the agent never picks, and wine marks only the PM's choice.
- The canned sub-option templates are generic placeholders for an LLM. They state no facts about the team.
- Talking an option through in chat (F-12, F-13) is still not built. Clicking a node shows its card; it doesn't open a chat.

## Outcome

Fill this in on the review date: did PMs use sub-options and ratings, and did the tree help them see the trade-offs?
