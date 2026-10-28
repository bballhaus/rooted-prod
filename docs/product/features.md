# Rooted — Prototype Feature List

> **Source:** the team's Miro board "Decision Agent User Story Map" (Story Map, User Stories, Parking lot frames), exported 2026-10-28. "Decision Agent" was the working name; the product is Rooted.
> **Purpose:** Build reference for AI-assisted prototyping. Each feature has a stable ID; refer to IDs in build prompts (e.g. "implement F-07 and F-08").

---

## 1. Product summary

Decision Agent is an AI agent that helps product managers **make, log, and revisit decisions**. It gathers context from connected sources (Slack in MVP), lays out the possible options as a decision tree, lets the user chat through the rationale, logs the decision, and nudges them later to record the outcome.

### Release goals

| Release | Goal |
|---|---|
| **R1 — MVP** | Learn whether a PM trusts the context the agent gathers (goal) and can log a decision and find it again later (outcome). **Only the PM's own data is used.** |
| **R2** | Bring in more sources and the rest of the team: meeting transcripts, coworkers' data, related company decisions and stakeholders. |
| **R3** | A more proactive agent that works on its own and finds patterns: spotting pending decisions, logging results, trends and causal effects. Requires many logged decisions and enough history. |

### Personas

| Persona | Story | Maps to |
|---|---|---|
| **PM (primary)** | Log a decision and its rationale in one step, so the reasoning isn't lost. | F-14 (MVP) |
| PM | Choose what data the agent can see, so I can use it within my company's privacy rules. | F-02 (MVP) |
| PM | Click through past decisions with the context that led to them, so I can explain or revisit a call. | F-17, F-18 (MVP) |
| PM | Connect Slack and my docs tool, so the agent can pull context without me copying it in. | F-03 (MVP), F-R2-02 (R2) |
| PM | Enter a decision I need to make and see related context and past decisions, so I start informed. | F-04, F-06 (MVP) |
| PM | Get a nudge on the review date to record the result, so every decision gets an outcome. | F-16 (MVP) |
| New PM | See historical decisions of my team, so I can decide future topics with more confidence. | F-R2-07 (R2) |
| Manager / exec | See my organization's decisions, so I can track choices made across teams. | F-R2-08 (R2) |
| Manager / exec | Use the decision tree to look for patterns, so we identify consistent existing roadblocks. | F-R3-05 (R3) |
| Startup founder | Be on the same page with decisions, so my company can move quickly and efficiently. | *Not mapped yet — open question* |

---

## 2. User journey (backbone)

Activities → Steps, left to right:

1. **Set up** → Log in · Connect sources
2. **Prepare for decision** → Enter decision · Gather context · Review context
3. **Make the decision** → Review options · Talk it through · Log decision · Record outcome
4. **Trace decision history** → Find past decisions · Review a past decision
5. **Manage account and get help** → Sign up · Manage account · Plan and billing · Notification settings · Get help

---

## 3. R1 — MVP features (BUILD THESE FIRST)

### Activity: Set up

| ID | Step | Feature | Acceptance notes |
|---|---|---|---|
| F-01 | Log in | Log in to the portal with permissions | Authenticated session; user has a role/permission level. |
| F-02 | Log in | Choose what data the agent can see | Settings UI to include/exclude channels/sources; agent respects these scopes. |
| F-03 | Connect sources | Connect Slack so the agent can pull context | OAuth-style "Connect Slack" flow (mock in prototype); shows connected state + selected channels. |

### Activity: Prepare for decision

| ID | Step | Feature | Acceptance notes |
|---|---|---|---|
| F-04 | Enter decision | **[Manual]** Enter the decision you need to make | Form/prompt: decision question, optional due/review date. |
| F-05 | Enter decision | Provide context on your own | User can paste notes/links/text as extra context. |
| F-06 | Gather context | Collect context from sources and past decision trees | Agent pulls relevant Slack messages + the user's own past decisions; shows a loading/gathering state. |
| F-07 | Gather context | Organize context into searchable lists | Context grouped (e.g. by source/theme) with search/filter. |
| F-08 | Review context | Give feedback and fix inaccurate context | Each context item can be marked wrong, edited, or removed. |
| F-09 | Review context | Agent flags missing information | Callout listing gaps / questions the agent couldn't answer. |

### Activity: Make the decision

| ID | Step | Feature | Acceptance notes |
|---|---|---|---|
| F-10 | Review options | Generate the branches and decisions you can make | Agent produces a **decision tree** of options/sub-options. |
| F-11 | Review options | Present the options | Visual tree/cards view of options with pros/cons and supporting context. |
| F-12 | Talk it through | Chat through the rationale | Chat panel with the agent, grounded in gathered context. |
| F-13 | Talk it through | Click a decision (option) to open a chat about the details | Clicking a tree node opens a chat scoped to that option. |
| F-14 | Log decision | Log decision and rationale in one step | Single "Log decision" action captures chosen option + rationale + context snapshot. |
| F-15 | Log decision | Write a short summary, AI fills in the rest | User writes 1–2 lines; AI drafts the full record (rationale, alternatives, context); user can edit. |
| F-16 | Record outcome | On the review date, get a nudge to log result and metrics | Nudge (Slack or email, per F-24) on review date → outcome form (result + metrics). |

### Activity: Trace decision history

| ID | Step | Feature | Acceptance notes |
|---|---|---|---|
| F-17 | Find past decisions | Click through your own past decisions | List/timeline of the user's logged decisions with search; opens detail view. |
| F-18 | Review a past decision | See options not taken and why they were rejected | Detail view shows rejected branches + reasons. |
| F-19 | Review a past decision | Hover to reveal context and the decision tree behind it | Hover/expand reveals source context and the full tree. |

### Activity: Manage account and get help

| ID | Step | Feature | Acceptance notes |
|---|---|---|---|
| F-20 | Sign up | Request beta access with work email | Waitlist/beta request form. |
| F-21 | Sign up | Sign in with Slack or Google | SSO buttons (mocked in prototype). |
| F-22 | Manage account | Edit profile, role and team | Profile settings page. |
| F-23 | Manage account | Disconnect sources and delete your data | Disconnect per source; delete-all-data with confirmation. |
| F-24 | Plan and billing | See your plan and beta status | Read-only plan/beta status card. |
| F-25 | Notification settings | Choose where nudges arrive (Slack or email) | Channel preference toggle. |
| F-26 | Notification settings | Set default review dates for outcomes | Default offset (e.g. 30/60/90 days) applied to new decisions. |
| F-27 | Get help | Help center and FAQ | Static help/FAQ page. |
| F-28 | Get help | Contact support or report a wrong answer from the agent | Support form + "report wrong answer" action on agent outputs. |

---

## 4. R2 features (team + more sources)

| ID | Step | Feature |
|---|---|---|
| F-R2-01 | Log in | Coworkers grant access to their data |
| F-R2-02 | Connect sources | Add meeting transcripts (Granola, Fireflies) |
| F-R2-03 | Connect sources | Connect docs/Notion, Gmail and calendar |
| F-R2-04 | Log in | Full security and compliance review |
| F-R2-05 | Gather context | Agent runs a pass on related company decisions |
| F-R2-06 | Gather context | Identify blockers and what relies on the decision |
| F-R2-07 | Find past decisions | Trace others' past decisions (with permission) |
| F-R2-08 | Find past decisions | See your organization's decisions across teams |
| F-R2-09 | Review options | Explore future implications via context |
| F-R2-10 | Talk it through | Reach out and flag other relevant stakeholders |
| F-R2-11 | Log decision | Notifications to fill in decisions you didn't log |
| F-R2-12 | Review a past decision | View the results of a decision |
| F-R2-13 | Sign up | Accept a teammate's invite to join the workspace |
| F-R2-14 | Manage account | Invite teammates and set who can view vs. edit |
| F-R2-15 | Manage account | Admin controls: SSO and audit log |
| F-R2-16 | Plan and billing | Upgrade to Team and manage editor seats |
| F-R2-17 | Plan and billing | View invoices and update payment method |
| F-R2-18 | Notification settings | Weekly digest of open decisions |
| F-R2-19 | Get help | Guided onboarding for new teams |

---

## 5. R3 features (proactive agent + patterns)

| ID | Step | Feature |
|---|---|---|
| F-R3-01 | Connect sources | Microsoft Teams, for companies not on Slack |
| F-R3-02 | Connect sources | Ingest company tech stack |
| F-R3-03 | Enter decision | Get notified of upcoming decisions |
| F-R3-04 | Enter decision | **[Automatic]** AI scans new PRDs and Slack for pending decisions |
| F-R3-05 | Find past decisions | View personal and company decision trends |
| F-R3-06 | Record outcome | Agent automatically logs relevant results |
| F-R3-07 | Review a past decision | See causal effects that led to a decision |
| F-R3-08 | Review a past decision | Flag org-level decisions to revisit |
| F-R3-09 | Plan and billing | Enterprise contract: data residency and retention |
| F-R3-10 | Get help | Status page and changelog |

---

## 6. Suggested prototype screens (MVP)

| Screen | Features |
|---|---|
| Sign up / Sign in | F-01, F-20, F-21 |
| Onboarding: connect Slack + data scope | F-02, F-03 |
| New decision | F-04, F-05 |
| Context review | F-06, F-07, F-08, F-09 |
| Decision tree + chat (core screen) | F-10, F-11, F-12, F-13 |
| Log decision modal | F-14, F-15 |
| Outcome nudge + outcome form | F-16 |
| Decision history list | F-17 |
| Decision detail | F-18, F-19 |
| Settings (profile, sources, notifications, plan) | F-22–F-26 |
| Help / report issue | F-27, F-28 |

### Core data objects (suggested)

- **User**: name, email, role, team, plan/beta status, notification channel, default review offset
- **Source**: type (Slack…), connected, scopes/channels allowed
- **Decision**: question, status (open / decided / outcome logged), created date, review date, summary, rationale, chosen option
- **ContextItem**: source, snippet, link, group/tag, flagged-inaccurate, user-edited
- **OptionNode** (tree): label, parent, pros/cons, rough 1–5 ratings (impact, effort, risk, evidence), chosen / rejected, rejection reason
- **ChatMessage**: decision, optional option node, role, text
- **Outcome**: decision, result, metrics, logged date

### Prototype guidance

- Mock all integrations (Slack, Google SSO, notifications) with realistic sample data; no real OAuth needed.
- MVP uses **only the current PM's own data** — no team/org views.
- Every agent output should offer "report wrong answer" (F-28) and editable context (F-08), since trust in context is the MVP's key metric.

---

## 7. Open questions & implementation notes (Parking lot)

### Open questions

- How do you define a decision? (Answer first.)
- How important are decisions?
- How much usage do we need to produce trends and patterns?
- How does the agent deal with missing information?
- What happens if certain decisions have privacy requirements?
- What if a company has privacy requirements?
- MVP source: Slack or meeting transcripts?
- What does the startup founder need to do?

### How do we implement?

- Slack and Microsoft Teams are likely mutually exclusive.
- Integration with Granola and Fireflies.
- Connect to the tech stack.
- Platform for traceability.
- Privacy and security compliance applies to every story.
