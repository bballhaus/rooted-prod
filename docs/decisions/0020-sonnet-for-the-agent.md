# 0020: Run the agent on Claude Sonnet 5.5, not Opus 5.5

- **Status:** decided
- **Date:** 2026-11-13
- **Decided by:** Shirley (PM)
- **Review date:** 2026-12-02
- **Features:** every AI feature (0016); supersedes the model choice in 0016

## Question

Decision 0016 ran every task on Claude Opus 5.5 and left "revisit the one-model choice" open. With the service live, the PM found answers too slow: Patterns in particular took long enough to feel stuck. Which model should the agent use?

## Context

- **Opus 5.5:** $4 input / $20 output per million tokens, and thinking can't be turned off.
- **Sonnet 5.5:** $2 / $10, faster, and takes the same request: effort, structured output, and server-side fallback (`fallbacks: "default"`, which falls back to Claude Sonnet 5 at the same price).
- **Haiku 5.5:** the cheapest and fastest, but has no server-side fallback.

## Options

### Chosen: Claude Sonnet 5.5 for every task, at the same effort levels

- **The change:** one model id in `ai/rooted_ai/claude.py`, and Sonnet prices in `ai/rooted_ai/limits.py`, so the daily cap counts the right cost.
- **What stays:** the prompts, schemas and grounding checks are unchanged.
- **Budget:** each call's worst case halves, so the same `DAILY_BUDGET_USD` covers about twice as many calls.

### Pruned: stay on Opus 5.5, lower effort

It's still the slower, pricier model, and Opus 5.5's thinking can't be switched off.

### Pruned: Haiku 5.5 for everything, or per task

It's the fastest and cheapest, but has no server-side fallback, so a safety decline would end the request. Weighing evidence and options is also where a bigger model earns its cost. Haiku for the light tasks (tags, chat) stays a later option once there are quality numbers.

## Consequences

- **Quality:** answers may be a little less thorough. Watch the "report wrong answer" rate.
- **Deploy:** it takes effect when a person redeploys the AI service.

## Outcome

Fill this in on the review date: did answers get fast enough, and did wrong-answer reports go up?
