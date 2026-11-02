# 0008: Add two restrained accents, lay the map out by thread, and give sign-in its own page

- **Status:** decided
- **Date:** 2026-10-31
- **Decided by:** Shirley (PM)
- **Review date:** 2026-11-25, after the first round of prototype user tests
- **Features:** F-01, F-17, F-19, F-20, F-21

## Question

The PM found the map hard to read, the sign-in flow bland, and the palette too plain. What changes, without going overboard?

## Context

In team lanes, linked decisions sat in different lanes, so most links were long lines crossing the whole map. The sign-in page was a heading and two buttons on cream. The palette is five colors (wine, berry, sage, charcoal, cream), and the app used mostly charcoal and cream.

## Options

### Chosen: threads, focus highlighting, two accents and person colors, a split sign-in page

- **Map.**
  - Lanes default to threads: decisions joined by confirmed links share a lane, named after the thread's most-used tag. Unlinked decisions go in "Not linked yet".
  - A link from Rooted joins a thread only once someone accepts it.
  - Links stay faint until a decision is hovered or picked. Then its links darken and unrelated cards fade.
  - A follow-up that starts before its parent's card ends hangs off the parent as a right-angle elbow, not a curve over the cards.
  - Cards are larger, and a status stripe runs down the left edge.
- **Accents.**
  - `--ochre` marks work in progress (open decisions, drafts, the current setup step).
  - `--moss` marks a closed loop (outcome logged).
  - Seven muted `--person-*` colors tint avatars and person lanes, so who decided reads at a glance.
  - Wine still marks only the chosen option, and dusty red still means due.
- **Sign-in.**
  - A split page: a wine brand panel with a small decision tree and three plain promises, beside tabs for "Sign in" (Google and Slack, still mocked) and "Request access" (F-20).
  - The request-access tab checks a work email and says thanks. It stores and sends nothing.
  - Onboarding gets a quiet header and a three-step indicator.

### Pruned: a brighter palette or a gradient-heavy theme

It's off-brand for "calm, warm, considered" (`design-language.md` §1), and the PM asked not to go overboard.

### Pruned: keep team lanes and bundle the edges

It's harder to build and still crosses lanes. Threads match how a PM thinks about a chain of decisions.

## Consequences

- New tokens in `src/styles/global.css` and `design-language.md` §3.2.
- The brand panel uses cream-on-wine literals, which match `--soil` in both themes.
- Beta-request emails are never persisted, in line with `AGENTS.md`'s rule on beta-signup emails.

## Outcome

Fill this in on the review date: could testers follow a thread on the map without help?
