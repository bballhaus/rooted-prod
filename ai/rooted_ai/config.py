"""Settings for Rooted's AI service (decision 0016), read from Modal secrets."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_anon_key: str
    # Browser origins allowed to call the service. The first is where Slack's
    # install flow sends the PM back to.
    app_origins: tuple[str, ...]
    # Spending across all users per UTC day. With open sign-up (0015), a new
    # account resets a per-user limit, so this cap is the real bound.
    daily_budget_usd: float = 5.0
    user_calls_per_window: int = 30
    window_seconds: int = 600
    slack_client_id: str = ""
    slack_client_secret: str = ""
    slack_state_secret: str = ""
    slack_redirect_uri: str = ""  # this service's /slack/callback URL

    @property
    def slack_configured(self) -> bool:
        return bool(self.slack_client_id and self.slack_client_secret and self.slack_state_secret and self.slack_redirect_uri)

    @classmethod
    def from_env(cls) -> "Settings":
        origins = tuple(o.strip().rstrip("/") for o in os.environ.get("APP_ORIGINS", "").split(",") if o.strip())
        return cls(
            supabase_url=os.environ.get("SUPABASE_URL", "").rstrip("/"),
            supabase_anon_key=os.environ.get("SUPABASE_ANON_KEY", ""),
            app_origins=origins,
            daily_budget_usd=float(os.environ.get("DAILY_BUDGET_USD", "5")),
            user_calls_per_window=int(os.environ.get("USER_CALLS_PER_WINDOW", "30")),
            window_seconds=int(os.environ.get("RATE_WINDOW_SECONDS", "600")),
            slack_client_id=os.environ.get("SLACK_CLIENT_ID", ""),
            slack_client_secret=os.environ.get("SLACK_CLIENT_SECRET", ""),
            slack_state_secret=os.environ.get("SLACK_STATE_SECRET", ""),
            slack_redirect_uri=os.environ.get("SLACK_REDIRECT_URI", ""),
        )
