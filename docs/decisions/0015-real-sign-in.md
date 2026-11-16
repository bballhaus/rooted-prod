# 0015: Real sign-in with Supabase Auth: email link, Google and Slack

- **Status:** decided
- **Date:** 2026-11-11
- **Decided by:** Shirley (PM)
- **Review date:** 2026-12-02, after the first testers sign in
- **Features:** F-01, F-21; touches F-20

## Question

Sign-in was mocked: every visitor became the same sample PM. The next step makes the agent's features real (calling an LLM), and the server must know who is asking before it spends on them. How do people sign in for real?

## Context

- 0002 chose Supabase for auth. The project (`hxqyudcrlzkiqiwithke`) already exists and is shared with the landing page, which keeps its beta sign-ups there. Its Site URL belongs to the landing page.
- Decisions, options and outcomes still live in each browser's `localStorage`. No tables are wired in yet.
- PMs live in Google Workspace and Slack, so those are the sign-ins they'd expect. An email link covers everyone else.

## Options

### Chosen: Supabase Auth with an email link, Google and Slack

- **How it works.** It adds one dependency, `@supabase/supabase-js`, pinned to 2.117.3 (the version the Edge Function already uses). `src/auth/client.ts` is the only code that talks to Supabase Auth. It uses the PKCE flow and returns to `/signin`, which shows any error the provider sent back. Supabase decides who is signed in; the store only mirrors it (`src/auth/AuthContext.tsx`). Sign-out ends the session.
- **Setup is in the dashboards, not the repo.**
  - Email, Google and Slack (OIDC) are enabled in Supabase.
  - Redirect URLs are exact: `http://localhost:5173/**` and the production domain. No wildcard for Vercel previews: `*-team.vercel.app` also matches domains anyone can claim, which would let an attacker receive another person's sign-in code. When previews exist, add each stable preview domain exactly. The Site URL is left alone, because it belongs to the landing page.
  - Google: a Google Cloud OAuth client, in Testing mode with listed test users.
  - Slack: a Slack app asking only for `openid`, `email` and `profile`. It isn't publicly distributed yet.
- **Signing in with Slack only proves who you are.** It shares no messages, and the sign-in page says so. Connecting Slack data (F-02, F-03) stays mocked and is a separate feature.
- **Open sign-up.** Anyone can create an account with the email link (Google and Slack are limited by their own settings until published). The PM chose this for public user testing. The server, not the app, has to bound the cost: see Consequences.
- **Each browser keeps one person's workspace.** The store remembers whose workspace it is through sign-out (`lastUser`). The same person signing back in gets their workspace and profile back. Anyone else starts from a fresh one. A user left over from the mocked sign-in counts as the same person if the email matches.
- **Role comes later.** A real user starts with no role or team. They fill these in under Settings (F-22). F-01's "user has a role/permission level" is only partly met until permissions exist.
- **No fallback.** Without the Supabase URL and key, the app says sign-in isn't set up. It doesn't sign anyone in.

### Pruned: keep the mocked sign-in until real tables exist

The AI features need a verified user on the server. A mocked user can't be verified, so real sign-in comes first.

### Pruned: invite-only, or an allowlist for AI

Turning off sign-ups in Supabase, or keeping a list of emails that may use the AI, would bound cost and privacy most tightly. The PM chose open sign-up so outside testers can try Rooted without being invited first.

### Pruned: email link only

It's the least setup, but PMs expect Google, and Slack fits the product. Each took about half an hour in a dashboard.

### Pruned: a separate auth service (Clerk, Auth0)

It would add a second vendor next to Supabase (0002) for no gain at this size.

## Consequences

- Supabase's built-in email sender only reaches members of the Supabase team and sends a few emails an hour. **Before outside testers, set up custom SMTP** (e.g. Resend).
- Google stays in Testing mode, so only listed test users can sign in, until the app is published. Publishing needs a privacy policy URL. Google's consent screen names the Supabase domain, not Rooted, unless a custom domain is bought.
- The Slack app works only in its own workspace until public distribution is turned on.
- **The AI server must bound its own cost.** With open sign-up, a new email gets a new account, so a per-user rate limit alone can be dodged. The AI service needs a per-user limit *and* a global daily spending cap.
- **Sign-in accounts are shared with the landing page's project.** Anyone can now hold an `authenticated` token there. Before merging, a person checks that no landing-page policy grants `authenticated` more than `anon`: `select * from pg_policies where schemaname = 'public';`. That matters most for `beta_signups`, where such a policy would expose sign-up emails. Product tables, when they come, get row-level security, and nothing touches `beta_signups`.
- **"Request access" (F-20) is still mocked.** It stores and sends nothing, and says so when submitted.
- Tests never call Supabase: `src/test/fakeAuth.ts` stands in for it.

## Outcome

Fill this in on the review date: could testers sign in on their first try, and which option did they pick?
