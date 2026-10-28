# Rooted: product overview

Snapshot: 2026-10-28. Condensed from the team's Week 5 milestone, the Miro story map and the "Rooted - Agent Context" pack in the team Drive. It describes the planned product, not working software. When this file and those sources disagree, the sources win; update this file.

## Problem and user

AI lets engineering ship in days, so PMs have to decide in days. One interviewee said they can now plan "a day ahead at best," down from 6–12 weeks. Context is scattered across Slack threads, docs and chatbot sessions, and the reasoning behind a call gets lost.

The first user is a hands-on PM or product owner at an early-to-mid-stage, AI-native startup, with about 5–10 engineers per PM, who owns the tradeoffs. Buyer, budget and willingness to pay are not validated.

Interviewees trust AI to support a decision but not to make it. Rooted gathers and organizes evidence, proposes options and points out gaps; the PM reviews the context and makes the call. Autonomous decision-making is out of scope.

## Core workflow

1. **Set access:** sign in, choose what data the agent may see, connect Slack.
2. **Frame the decision:** enter it by hand and add context. Detecting pending decisions automatically is Release 3.
3. **Prepare evidence:** the agent gathers relevant messages and the PM's past decisions. The PM corrects mistakes and sees what's missing.
4. **Explore options:** the agent lays out options as a decision tree. The PM chats through the rationale, overall or per option.
5. **Record the choice:** one step logs the chosen option, rationale and a context snapshot. Rejected options stay visible with their reasons. The PM can write a line or two and have the AI draft the rest.
6. **Revisit:** find the decision later and see why alternatives lost. On the review date, a nudge asks for the result and metrics.

**MVP learning goal:** does a PM trust the gathered context, log a decision, and find it again later?

## Releases

| Release | Scope |
|---|---|
| 1: MVP | The PM's own data only. Slack context, manual decision entry, context correction, options and rationale chat, one-step logging, past and rejected options, outcome reminders, account, settings, help. Feature IDs `F-01`–`F-28`. |
| 2: Team | Coworkers' data with permission, meeting transcripts (Granola, Fireflies), Docs/Notion/Gmail/Calendar, stakeholders and dependencies, weekly open-decision digest, SSO, roles, billing. `F-R2-xx`. |
| 3: Proactive | Microsoft Teams, spotting pending decisions in PRDs and Slack, automatic outcome logging, decision patterns across the company. `F-R3-xx`. |

The full list with acceptance notes is `features.md`.

## Evidence so far

- 16 discovery interviews in Weeks 1–2 with PMs and PM-adjacent roles. Decision overload was coded in 5 of 16; the team picked it over AI-as-teammate (9) and prioritization (8) because no tool helps PMs make the call and the problem grows as AI speeds up building. These are qualitative coding counts, not prevalence.
- Week 5 smoke test of the landing page: 51 visitors, 29 past the hero, 1 PM sign-up against a target of 5. The team counts it as failed. Sign-up was free, so it shows interest, not willingness to pay.
- Closest competitors: Claude and ChatGPT (you re-paste context every time and they don't remember past decisions), Glean, Jira, and overlapping features in Atlassian Rovo Decision Director, Dovetail AI and Productboard Pulse. "Nothing records why" is too broad a claim. The sharper bet is linking decisions, reasoning, rejected options and outcomes over time.

## Open questions

These are unresolved. Don't answer them in code; raise them with the team.

- What counts as a decision, and which ones are worth capturing? The parking lot marks this "answer first."
- Slack or meeting transcripts as the first context source? The story map picks Slack; the parking lot still asks.
- Which story leads: gathering context (the value proposition) or mapping and scoring options (the landing page)?
- How does the agent handle missing information, and what about decisions or companies with privacy requirements?
- Can logging save PMs time without becoming documentation busywork?
- Which activation target do we test: 2 decisions by day 7 (opportunity tree) or 3+ decisions in 2 weeks plus a return visit (funnel)?
- What does the startup-founder persona need? Not mapped to a workflow step yet.

## Course context

Stanford CS 177, Product Management with AI (Fall 2026). Team 10 (Geckos): Ruba Ahmed, Shirley Zhang, Brooke Ballhaus, Genc Saracaydin, Renn Su. The Week 6 milestone is a publicly hosted prototype; including settings and help pages (F-22–F-27) earns a ✓+. The final one-pager, prototype and pitch deck are due Dec 1.
