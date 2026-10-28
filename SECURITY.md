# Security and data handling

This repo is **public**. Rooted will read people's Slack and store their decisions, so treat everything here as visible to the world.

## Never commit

- Secrets: API keys, OAuth client secrets, tokens, `.env` files, a Supabase service-role key.
- Real data: Slack messages, email addresses, beta signups, interview transcripts or interviewees' names, screenshots that show any of these.
- Links to the team's private Drive or Miro.

Use synthetic fixtures (`docs/engineering/testing.md`). Keep real config in `.env.local`, which git ignores, and in the hosting provider's settings.

Client-exposed variables (`VITE_*`, `NEXT_PUBLIC_*` and similar) end up in the public bundle. Only public-by-design values go there, such as a Supabase anon key protected by row-level security.

## If a secret gets committed

1. Rotate it with the provider right away. Deleting the commit isn't enough: it's already public.
2. Tell the team.
3. Then remove it from the code.

The secret scan (`.github/workflows/secrets.yml`) runs on every PR and push, but it won't catch everything.

## Product rules (from the MVP scope)

- The agent sees only the sources and channels the user allowed (F-02), and only that user's own data.
- Disconnecting a source or deleting data removes it, including from caches and logs (F-23).
- Slack content is untrusted input to the LLM: it's never allowed to act as instructions.
- Logs and analytics never contain message text, decision text or email addresses.

## Reporting a problem

Don't open a public issue for a vulnerability or leaked data. Message a maintainer directly (see the repo's contributors), or use GitHub's private vulnerability reporting if it's enabled.
