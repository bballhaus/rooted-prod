# 0017: Connect Slack for real, reading public channels on the server

- **Status:** decided
- **Date:** 2026-11-13
- **Decided by:** Shirley (PM)
- **Review date:** 2026-12-02
- **Features:** F-02, F-03, F-06, F-23

## Question

Rooted's Slack was sample data behind a mocked "Connect" dialog. Now that the agent is real (0016), should it read a real Slack workspace, and how, without overreaching?

## Context

- The story map picks Slack as the MVP source. Whether meeting transcripts should come first stays an open question; this doesn't settle it.
- Sign-in with Slack (0015) only proves who someone is. Reading messages needs a bot token with channel-history scopes.
- SECURITY.md: the agent sees only allowed channels; revoking access removes what was gathered; logs never hold message text.

## Options

### Chosen: Rooted's Slack app as a bot with read-only public-channel scopes, read on demand

- **Scopes.** `channels:read`, `channels:history`, `channels:join` (to read a public channel the PM allows) and `users:read` (to show who wrote a message). It has no private-channel or DM scopes, so it can't read them.
- **Install.** "Connect Slack" asks the service for Slack's install URL. The state is HMAC-signed, bound to the PM and expires in 10 minutes.
  - **No token at the callback.** After Slack's permission page, `/slack/callback` stores nothing; it hands the code and state back to the app.
  - **Finished signed in.** The app sends them to `/slack/complete` as the signed-in PM. The service exchanges the code only if that PM is the one who started the install, so a link someone else started can't capture another person's workspace.
  - **Messages.** Cancelled, expired, failed or mismatched installs come back with a message.
- **One token per workspace.** Slack gives an app one bot token per workspace. It's stored once, with the Rooted people using it. Disconnecting removes only that person, and the token is revoked when the last one leaves.
- **Allowed channels.** Public channels show up unchecked; the PM checks the ones Rooted may read. The app sends only allowed channel ids. The server ignores any id that isn't a public channel in the workspace.
- **Reading.** For a brief or for spotting decisions, the service reads the last 30 days of the allowed channels (up to 200 messages each, 400 in all, skipping bot and system posts). It keeps them only for that request. The few messages Claude cites get Slack permalinks.
- **Disconnect and delete.** Disconnect and "Delete all data" revoke the token with Slack and forget it, and context gathered from Slack is dropped in the app (F-23). That includes "Delete all data" from inside the demo.
  - If the revoke fails, the app says so and keeps Slack shown as connected.
  - A token revoked in Slack shows as disconnected.
- **The demo never reads it.** The demo uses only its own sample sources; the PM's live Slack is set aside until they leave the demo.
- **The demo is unchanged.** It keeps its sample Slack and Drive (marked `sample: true`) and sends those messages to the same AI.

### Pruned: store messages in Supabase tables

That means faster briefs and search, but it stores people's messages, which needs migrations, row-level security, retention rules and deletion on revoke. Reading on demand stores nothing.

### Pruned: user tokens instead of a bot

That would read whatever the PM can see, private channels included. That's more than F-02 allows.

### Pruned: Google Drive in this round

Not built. Real workspaces show Drive as "not available yet".

## Consequences

- **Setup by a person.** On the Slack app (api.slack.com, app "Rooted"):
  - Add the four bot scopes.
  - Add the service's `/slack/callback` URL as a redirect URL.
  - Create the Modal secret `rooted-slack` with `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_STATE_SECRET` (a long random string) and `SLACK_REDIRECT_URI`.
  - Turn on public distribution for other workspaces, which a workspace admin may need to approve.
- **Token storage.** Bot tokens live in a Modal Dict, private to the Modal workspace, not in the browser or the repo. They aren't encrypted beyond Modal's own storage.
- **Message limit.** A brief reads at most 400 messages, so older context isn't seen.
- **Slack's rate limits.** Since 2025, Slack heavily rate-limits `conversations.history` for apps distributed outside its Marketplace: about one request a minute and 15 messages per request. Confirm against the app's settings. When a later channel is rate-limited, the brief keeps what it read. For full limits, keep the app undistributed (internal to the team's workspace) or apply to the Marketplace.
- **Scope change.** This amends 0005, which scoped the MVP to synthetic data: the PM's own Slack is now read for real.
- **Teammates aren't asked.** Their public-channel messages are read when the PM allows a channel. Whether and how to ask or tell them is an open decision (decisions README). Decide it before outside testers.
- **What Claude sees.** Slack text from allowed channels goes to Claude for the request, as untrusted data (0016).

## Outcome

Fill this in on the review date: did PMs connect Slack, which channels did they allow, and was 30 days enough?
