# Rooted's AI service

A Python service on [Modal](https://modal.com) that answers every agent task by calling Claude, and holds the real Slack connection. Decisions [0016](../docs/decisions/0016-ai-on-modal-with-claude.md) and [0017](../docs/decisions/0017-real-slack-connection.md) explain why it's built this way.

| Path | What it does |
|---|---|
| `POST /agent` | `{ task, payload }`. The tasks are `chat`, `suggestTags`, `brief`, `options`, `subOptions`, `draftRecord`, `findLinks`, `spotDecisions` and `findPatterns` (0019). Returns `{ ok: true, result }` or `{ ok: false, error }`. |
| `GET /slack/status` | Whether this person's Slack is connected, and its public channels. |
| `POST /slack/install` | The URL of Slack's permission page. |
| `GET /slack/callback` | Where Slack sends the person back. It stores nothing and hands the code back to the app. |
| `POST /slack/complete` | `{ code, state }`, signed in. Saves the install only for the person who started it. |
| `POST /slack/disconnect` | Revokes the bot token and forgets it. |

Every call needs the PM's Supabase access token as `Authorization: Bearer …`.

## Test it locally

```bash
python3 -m venv ai/.venv
ai/.venv/bin/pip install -r ai/requirements-dev.txt
ai/.venv/bin/python -m pytest ai
```

The tests fake Claude and Slack, so they cost nothing and need no secrets.

## Deploy it (a person does this)

1. **Create the secrets in Modal.** Values never go in the repo or chat.

   ```bash
   python3 -m modal secret create rooted-anthropic ANTHROPIC_API_KEY=...
   python3 -m modal secret create rooted-ai-config \
     SUPABASE_URL=https://hxqyudcrlzkiqiwithke.supabase.co SUPABASE_ANON_KEY=sb_publishable_... \
     APP_ORIGINS=https://project-v6as2.vercel.app,http://localhost:5173 DAILY_BUDGET_USD=5
   python3 -m modal secret create rooted-slack \
     SLACK_CLIENT_ID=... SLACK_CLIENT_SECRET=... SLACK_STATE_SECRET=$(openssl rand -hex 32) \
     SLACK_REDIRECT_URI=https://<workspace>--rooted-ai-web.modal.run/slack/callback
   ```

2. **Deploy:** `python3 -m modal deploy ai/modal_app.py`. Modal prints the service URL.
3. **Point the app at it:** set `VITE_AI_URL` to that URL in `.env.local` and in Vercel (Production and Preview), then redeploy the site.
4. **Set up the Slack app** (api.slack.com, app "Rooted"):
   - Under **OAuth & Permissions**, add the bot scopes `channels:read`, `channels:history`, `channels:join` and `users:read`.
   - Add the redirect URL from step 1.
   - To let other workspaces connect, turn on **Manage Distribution → public distribution**.

## Costs and limits

Every task runs on Claude Sonnet 5.5 (decision 0020):

- **Per person:** 30 calls per 10 minutes.
- **Whole app:** the daily cap `DAILY_BUDGET_USD` (UTC day). Once it's reached, AI features say so until midnight UTC.

**Set a spend limit on the Anthropic key** in the Anthropic Console. It's the hard backstop. The daily cap reserves each call's worst case before it runs, but its counters are best effort across Modal's containers (at most 3).

Logs record the task, the error code and the cost, never what anyone wrote.
