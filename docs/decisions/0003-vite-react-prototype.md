# 0003: Vite + React + TypeScript for the MVP prototype

- **Status:** decided
- **Date:** 2026-10-28
- **Decided by:** Brooke
- **Review date:** 2026-11-18
- **Features:** F-01 to F-28 (MVP prototype)

## Question

Which framework does the Week 6 MVP prototype use?

## Context

The repo was docs-only (0001). The landing page (`rrsudev/CS177-geckos`) is Vite + React 18, so its tokens and components port over directly. The prototype mocks every integration with sample data (`AGENTS.md`), so it needs no server yet. Database and auth stay Supabase (0002) for when real data arrives.

## Options

### Chosen: Vite + React 18 + TypeScript, Vitest + Testing Library

A client-only single-page app with react-router and a small reducer store persisted to `localStorage`. Closest to the landing repo, fastest to demo, and the store can be swapped for Supabase later.

### Pruned: Next.js + React + TypeScript

Server routes would help once a real LLM or Slack OAuth is wired in, but they add setup the mocked prototype doesn't need, and the code drifts further from the landing page.

### Pruned: Plain HTML and JavaScript

No build step, but it wouldn't grow into the product and has no type checking for agents to lean on.

## Consequences

- No server: the "agent" is a set of deterministic mock functions in `src/agent/`. The LLM provider and hosting are still open.
- Moving to real data means replacing the reducer store with Supabase calls, migrations and row-level security, per `AGENTS.md`.
- If the real LLM needs server-side keys, revisit this (a Vite app plus serverless functions, or Next.js).

## Outcome

Fill this in on the review date.
