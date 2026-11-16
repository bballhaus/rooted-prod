# 0007: Call the LLM from a Supabase Edge Function, with scripted sample answers as the fallback

- **Status:** superseded by [0016](0016-ai-on-modal-with-claude.md)
- **Date:** 2026-10-31
- **Decided by:** Shirley (PM)
- **Review date:** when the team picks a provider
- **Features:** F-12, F-13, F-15, AI search, AI tags

## Question

The working MVP needs a real agent for chat, search and tag suggestions, but the team hasn't picked an LLM provider. How do we build the path to an LLM now without picking one, and keep the app working until a key exists?

## Context

The app is a client-only Vite build (0003), so an API key can't live in the browser. Supabase is already the backend (0002). The PM asked for the architecture to be built with the key slot left empty, and for the app to fall back to Wizard-of-Oz answers, labelled "Sample answer" so the team knows what still needs a real model.

## Options

### Chosen: Supabase Edge Function behind a provider adapter

- `supabase/functions/agent` takes `{ task, payload }` and answers `{ ok, result }`.
  - Only a signed-in Supabase user can spend the key. The public anon key alone gets `401 sign_in_required`. There's also a best-effort rate limit of 20 calls per user every 10 minutes per function instance, and a 2,048-token output cap.
  - Sign-in in the prototype is still mocked, so on the hosted project the app keeps using sample answers until real Supabase auth replaces it. For local testing only, `AGENT_ALLOW_ANONYMOUS=true` skips the user check. It must never be set on the hosted project.
  - It picks an adapter from `LLM_PROVIDER` and reads `LLM_API_KEY` and an optional `LLM_MODEL`, all as function secrets.
  - With no provider or key, it answers `503 not_configured`.
  - It constrains replies to a JSON Schema per task.
  - It never echoes provider error bodies.
- Slack text, notes, decisions, the decision and option in scope, and earlier chat turns all travel in tagged data blocks. The system prompt says to treat them as information, never as instructions.
- One adapter exists, for Anthropic. It uses the official SDK and defaults to `claude-opus-5-5` at low effort. A refusal or truncated reply counts as a failure. Adding another provider means one file and one registry line.
- In the browser, `src/agent/llm.ts` calls the function using `VITE_SUPABASE_URL` and the anon key. It returns nothing on any failure, including a 20-second timeout, and stops asking after `not_configured`. `src/agent/index.ts` then uses the scripted agent (`src/agent/chat.ts`, `tags.ts`) and marks the answer `sample: true`. The UI shows "Sample answer".
- Evidence gathering, option mapping and record drafting stay scripted for now. They read the synthetic corpus, which an LLM couldn't reach anyway.

### Pruned: call the provider from the browser

This would put the key in the bundle.

### Pruned: a Vercel function

Hosting is still open, and Supabase is already decided.

## Consequences

- The provider stays an open decision. Choosing one means setting three secrets (`supabase secrets set ...`, done by a person, per `AGENTS.md`), and possibly adding an adapter.
- Decisions, rationale and gathered context are sent to the provider when a key is set. `SECURITY.md` covers this.
- The edge function isn't deployed by CI or by agents. A person deploys it after merge.

## Outcome

Fill this in once a provider is chosen: which one, and how often did answers still fall back to samples?
