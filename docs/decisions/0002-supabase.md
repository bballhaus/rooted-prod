# 0002: Use Supabase for the database and auth

- **Status:** decided
- **Date:** 2026-10-28
- **Decided by:** Team 10
- **Review date:** 2026-11-03 (Week 6 prototype due)
- **Features:** F-01, F-14, F-17, F-23

## Question

Where do Rooted's users, decisions, context and outcomes live?

## Context

The landing page already uses Supabase in the team's organization, so the team knows it, and Postgres with row-level security fits per-user data (F-02, F-23). The framework, LLM provider and hosting are still open.

## Options

### Chosen: Supabase, project `hxqyudcrlzkiqiwithke`

Postgres with row-level security, Supabase Auth, and the Supabase CLI for migrations. New tables for the product, in the team's existing organization.

### Pruned: a separate database and auth provider

It would mean a second set of tools to learn, for no benefit the MVP needs.

## Consequences

- Schema changes are migrations in `supabase/migrations/`, made with the Supabase CLI and reviewed in a PR. Nobody edits the hosted schema by hand in the dashboard.
- Every table has row-level security on, with policies limiting rows to their owner. The security reviewer treats a table without it as critical.
- Tests run against a local Supabase (`supabase start`), never the hosted project.
- Migrations reach the hosted project only when a person applies them after merge. Agents don't run `supabase db push`.
- The `Decision` table waits on the open question "what counts as a decision."

## Outcome

To fill in on the review date.
