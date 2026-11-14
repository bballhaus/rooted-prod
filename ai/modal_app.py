"""Modal entry point for Rooted's AI service (decision 0016).

A person deploys it (`modal deploy ai/modal_app.py`); agents don't. Secrets:
- rooted-anthropic: ANTHROPIC_API_KEY
- rooted-ai-config: SUPABASE_URL, SUPABASE_ANON_KEY, APP_ORIGINS, DAILY_BUDGET_USD
- rooted-slack: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_STATE_SECRET, SLACK_REDIRECT_URI
"""

from pathlib import Path

import modal

HERE = Path(__file__).parent

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_requirements(str(HERE / "requirements.txt"))
    .add_local_python_source("rooted_ai")
)

app = modal.App("rooted-ai", image=image)

# Rate-limit counters, the daily spend and Slack bot tokens. Private to the
# Modal workspace; never sent to the browser.
state = modal.Dict.from_name("rooted-ai-state", create_if_missing=True)


@app.function(
    secrets=[
        modal.Secret.from_name("rooted-anthropic"),
        modal.Secret.from_name("rooted-ai-config"),
        modal.Secret.from_name("rooted-slack"),
    ],
    timeout=180,
    # A ceiling on how far a burst can scale out; the daily cap bounds spend.
    max_containers=3,
)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def web():
    import httpx

    from rooted_ai import slack
    from rooted_ai.auth import make_verifier
    from rooted_ai.claude import make_client
    from rooted_ai.config import Settings
    from rooted_ai.server import Deps, create_app

    settings = Settings.from_env()
    http = httpx.Client()
    return create_app(
        Deps(
            settings=settings,
            verify=make_verifier(settings, http),
            store=state,
            claude=make_client(),
            slack_api=slack.SlackApi(http),
        )
    )
