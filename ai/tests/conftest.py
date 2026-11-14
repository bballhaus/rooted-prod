"""Fakes for Claude and Slack, so no test spends money or touches a workspace."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rooted_ai import slack  # noqa: E402
from rooted_ai.auth import AuthUnavailable  # noqa: E402
from rooted_ai.config import Settings  # noqa: E402
from rooted_ai.limits import MemoryStore  # noqa: E402
from rooted_ai.server import Deps, create_app  # noqa: E402

NOW = 1_794_000_000.0  # 2026-11-06 UTC


def usage(input_tokens: int = 1000, output_tokens: int = 200) -> SimpleNamespace:
    return SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens, cache_read_input_tokens=0, cache_creation_input_tokens=0)


def reply(data: Any = None, *, text: str | None = None, stop_reason: str = "end_turn") -> SimpleNamespace:
    body = text if text is not None else json.dumps(data)
    return SimpleNamespace(stop_reason=stop_reason, content=[SimpleNamespace(type="text", text=body)], usage=usage())


class FakeClaude:
    """Stands in for anthropic.Anthropic: answers from a queue, or raises."""

    def __init__(self) -> None:
        self.answers: list[Any] = []
        self.calls: list[dict[str, Any]] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


class FakeSlack(slack.SlackApi):
    def __init__(self) -> None:
        self.calls: list[tuple[str, str | None, dict[str, Any]]] = []
        self.handlers: dict[str, Callable[..., dict[str, Any]]] = {}

    def call(self, method: str, token: str | None = None, **params: Any) -> dict[str, Any]:
        self.calls.append((method, token, params))
        handler = self.handlers.get(method)
        if handler is None:
            return {"ok": True}
        result = handler(**params)
        if isinstance(result, Exception):
            raise result
        return result


SETTINGS = Settings(
    supabase_url="https://example.supabase.co",
    supabase_anon_key="anon",
    app_origins=("https://rooted.example",),
    daily_budget_usd=1.0,
    user_calls_per_window=5,
    window_seconds=600,
    slack_client_id="cid",
    slack_client_secret="csecret",
    slack_state_secret="state-secret",
    slack_redirect_uri="https://ai.example/slack/callback",
)


class Env(SimpleNamespace):
    client: TestClient
    claude: FakeClaude
    slack_api: FakeSlack
    store: MemoryStore


@pytest.fixture
def env() -> Env:
    claude, slack_api, store = FakeClaude(), FakeSlack(), MemoryStore()
    users = {"good-token": "user-a", "other-token": "user-b"}

    def verify(token: str) -> str | None:
        if token == "down":
            raise AuthUnavailable()
        return users.get(token)

    deps = Deps(settings=SETTINGS, verify=verify, store=store, claude=claude, slack_api=slack_api, clock=lambda: NOW)
    return Env(client=TestClient(create_app(deps)), claude=claude, slack_api=slack_api, store=store)


AUTH = {"Authorization": "Bearer good-token"}
