# 0011: Host the prototype on Vercel as a static single-page app

- **Status:** decided
- **Date:** 2026-11-02
- **Decided by:** Shirley (PM)
- **Review date:** 2026-11-28, after the next round of prototype user tests
- **Features:** none (infrastructure)

## Question

Where does the prototype on `main` get hosted, so teammates and test users can open it without running it locally?

## Context

The app is client-only (0003): Vite builds static files into `dist/`, state lives in `localStorage`, and sign-in is mocked. The only server piece is the agent's Supabase Edge Function (0007), which is deployed to Supabase, not to the web host. The landing page (separate repo) is already on Vercel, so the team has an account and knows the flow. The app uses client-side routes (`/decisions/:id/work`), so the host must serve `index.html` for every path.

## Options

### Chosen: Vercel, static build with an SPA rewrite

- Build with `npm run build` and serve `dist/`. `vercel.json` rewrites every path to `/index.html`, so deep links and refreshes work.
- Each PR gets a preview deploy, so reviewers can click through UI changes (`CONTRIBUTING.md` asks reviewers to try them).
- No secrets live on the host. The two public `VITE_SUPABASE_*` values are optional. Without them, or without a signed-in Supabase user, the agent answers with labelled sample answers.
- A person connects the repo in Vercel and deploys. Agents don't.

### Pruned: Supabase or GitHub Pages

Supabase doesn't host static sites. GitHub Pages has no rewrite rules, so deep links would need a 404.html workaround, and it has no per-PR previews.

### Pruned: Netlify or Cloudflare Pages

Both would work as well. Vercel wins only because the landing page already runs there.

## Consequences

- `vercel.json` sits at the repo root. Changing the build output or routes means updating it.
- `.github/workflows/vercel-deploy.yml` deploys `main` to production on each push. It needs the repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`, which a person sets. If the Vercel GitHub app is connected too, turn off its production deploys for `main` so the two don't both deploy.
- The hosted prototype is public. It holds only synthetic fixtures, and each visitor's edits stay in their own browser.
- The LLM stays off on the hosted app until a person deploys the Edge Function and sets its secrets (0007), and real Supabase sign-in exists.

## Outcome

Fill this in on the review date: did previews make reviews faster, and did test users reach the app without help?
