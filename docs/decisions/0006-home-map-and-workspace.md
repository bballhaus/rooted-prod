# 0006: Make the decision map the home page, and think decisions through in one workspace beside the agent

- **Status:** decided
- **Date:** 2026-10-31
- **Decided by:** Shirley (PM)
- **Review date:** 2026-11-25, after the first round of prototype user tests
- **Features:** F-04–F-19, F-22–F-28

## Question

What should a PM see first, and how should a new decision be worked through?

## Context

Home was a flat list of decisions. Settings and help sat in the top navigation. A new decision moved through four separate pages (frame, brief, options, log), and the agent never talked to the PM. The PM's feedback: home should be a dashboard of decisions shaped like a tree, sortable by time, type and person. Settings and sign-out belong under a profile icon. Help belongs in the footer. The agent should be a circle in the corner that opens a chat at the side, where the PM can ask about decisions and start a new one.

## Options

### Chosen: map home, docked agent, one-page workspace

- **Home.** Above the fold, on the left, is a "Needs you" rail: outcomes due, deadlines, decisions Rooted spotted and drafts. Beside it is the decision map, built with React Flow (`@xyflow/react`).
  - Time runs left to right. Lanes group decisions by team, who decided, tag or status.
  - Filters narrow the map by person, tag and status. A list view shows the same decisions, and it's the default on phones.
  - Picking a decision opens its details: what was decided, why, what it was based on, who decided and who was consulted, options not taken, the outcome, and connected decisions.
- **Header.** It holds search (typing filters the map; Enter asks Rooted), New decision, an inbox bell with a dusty-red count of what's due, and a profile menu with settings and sign-out. Help, support, problem reports and privacy move to the footer.
- **Agent.** A ✦ circle in the corner opens a chat panel on the right. Answers cite decisions as links to the map, and every answer can be edited and reported (F-08, F-28). "Talk it through" on an option scopes the chat to that option (F-13). "Start a new decision" opens the new decision page beside the chat.
- **Workspace.** `/decisions/:id/work` stacks frame, evidence and options on one page and opens the agent beside it on wide screens. The old step URLs redirect to its sections. The record page gains the outcome form (F-16), who decided, tags and connected decisions.

### Pruned: keep the step pages and add a chat to each

This would keep four page loads per decision and split the conversation across pages.

### Pruned: hand-draw the map in SVG, like the option tree (0004)

Pan, zoom, lanes and around 20 or more nodes would all be custom work. React Flow does them and still lets the nodes use our own markup and tokens.

## Consequences

- New dependency: `@xyflow/react` 12. Its stylesheet is overridden through its CSS variables, so it follows the design tokens.
- Two new design tokens: `--alert` (dusty red, for what's due) and `--ai` / `--ai-line` / `--ai-bg` (a deeper sage, for what the agent suggested). Wine still marks only the chosen option.
- Tests for the step pages now run against the workspace. Tests for the old list page were replaced with tests for the map, filters, details, inbox and agent.
- The map is a canvas, so the list view is the accessible alternative. It holds the same decisions and actions.

## Outcome

Fill this in on the review date: did PMs find past decisions faster on the map than in the list, and did they use the agent while deciding?
