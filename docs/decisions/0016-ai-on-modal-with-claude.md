# 0016: Run the agent on Modal, calling Claude, with no scripted answers

- **Status:** decided (supersedes 0007)
- **Date:** 2026-11-13
- **Decided by:** Shirley (PM)
- **Review date:** 2026-12-02, after the first testers use it
- **Features:** F-06, F-07, F-09, F-10, F-11, F-12, F-13, F-14, F-15, F-19, F-R2 (spotting decisions); F-08 and F-28 on every surface

## Question

Every agent feature was faked: chat, tags, the evidence brief, options and sub-options, record drafts, links between decisions and spotted decisions came from scripted code or hand-written data, labelled "Sample answer". 0007 built a path to a real LLM but chose no provider. What should actually answer, and what happens when it can't?

## Context

- 0015 made sign-in real, so the server can tell who is asking. Sign-up is open, so the server must bound cost itself.
- The team chose Modal to run the AI service and Claude as the model, with an Anthropic key stored as the Modal secret `rooted-anthropic`.
- The repo's rules: AI output stays editable (F-08) and reportable (F-28), Slack text is untrusted input, and logs never hold people's words.

## Options

### Chosen: one Python service on Modal, Claude Opus 5.5, errors instead of fake answers

- **The service.** `ai/` is a FastAPI app deployed with `modal deploy ai/modal_app.py`. It has one `POST /agent` door for eight tasks: chat, suggestTags, brief, options, subOptions, draftRecord, findLinks and spotDecisions. It also has the Slack endpoints (0017). The app calls it at `VITE_AI_URL` with the PM's Supabase access token, which the service checks against Supabase Auth.
- **The model.** Every task calls `claude-opus-5-5` through the Anthropic Python SDK (pinned 1.17.0):
  - **Answer shape.** Answers come back as JSON matching a schema per task, then pass a check that drops anything not grounded in what was sent: a cited message, decision, evidence or option id the app never sent.
  - **Effort.** Chat and tags run at `low` effort, the rest at `medium`.
  - **Fallback.** Server-side fallback (`fallbacks: "default"`) re-runs a request a safety classifier declined on Anthropic's recommended model.
- **Prompt injection.** People's text (Slack, notes, past decisions) goes into JSON data blocks the prompt says never to follow, with `</` escaped so it can't close its block.
- **Limits.** Each person gets 30 calls per 10 minutes. All users share one daily spend cap (`DAILY_BUDGET_USD`, default $5), counted from each response's token usage at list prices. Both are kept in a Modal Dict, best effort across containers.
- **No scripted fallback.** When a call fails, the feature shows what happened (rate limited, budget reached, AI busy, timed out, declined, answer didn't hold up, not switched on), offers "Try again", and keeps the manual path open (add context, add an option, write the rationale, type tags). "Sample answer" labels are gone.
- **Removed.** The scripted agent (`mockAgent.ts`, `llm.ts` and the scripted halves of `chat.ts`, `brief.ts`, `options.ts`, `record.ts` and `tags.ts`) and the Supabase Edge Function from 0007. Header search keeps its plain keyword ranking (`src/store/search.ts`), which isn't AI.
- **Tests.** `ai/tests` (pytest) fakes Claude and Slack. The app's tests use `src/test/fakeAi.ts`. No test calls Claude.

### Pruned: keep the Supabase Edge Function and point it at Claude

That would work, but it would leave two backends once Slack needs server-side code (0017). Python on Modal also holds the prompts, schemas and checks in one place with ordinary unit tests.

### Pruned: an open-weights model on Modal GPUs

No API key, but weaker answers, cold starts of 30–90 seconds after idle, and GPU time billed per second.

### Pruned: keep the scripted answers as a fallback

They hid failures behind plausible text. That undercuts the MVP's learning goal, trust in gathered context, and the PM asked for them to go.

### Pruned: Claude Sonnet or Haiku for cheaper tasks

Considered for tags and chat. Kept on one model, with lower effort for the light tasks, until measurement shows a cheaper model holds quality.

## Consequences

- **A person deploys the service and sets its secrets.** Agents don't.
  - `rooted-anthropic`: `ANTHROPIC_API_KEY`.
  - `rooted-ai-config`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_ORIGINS`, `DAILY_BUDGET_USD`.
  - `rooted-slack`: see 0017.
  - The site needs `VITE_AI_URL`. Without it, every AI feature says it isn't switched on.
- **What Claude is sent.** Decision summaries, rationale, the PM's notes and the gathered context for the decision in scope go to Anthropic. Anthropic's data retention terms apply.
- **Cost.** Every call costs money. The daily cap bounds it; when it's reached, AI features pause until midnight UTC.
- **Python joins the repo** (`ai/`), with its own pinned requirements and a CI job.
- **Spotting decisions in Slack** (F-R2 preview) uses a neutral prompt: "choices the team seems to be facing". What counts as a decision stays an open question.

## Outcome

Fill this in on the review date: did testers trust the gathered context, how often did calls fail and why, and what did a day cost?
