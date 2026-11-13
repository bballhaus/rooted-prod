"""One structured call to Claude, with every failure turned into an error code."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import anthropic

MODEL = "claude-opus-5-5"
# If a safety classifier declines, Anthropic re-runs the request on its
# recommended model for that category instead of returning the refusal.
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class ModelError(Exception):
    """Claude couldn't give a usable answer. `code` is what the app shows a message for."""

    def __init__(self, code: str, usage: Any = None) -> None:
        super().__init__(code)
        self.code = code
        self.usage = usage


@dataclass
class ModelAnswer:
    data: dict[str, Any]
    usage: Any


def make_client() -> anthropic.Anthropic:
    # A minute per attempt; the SDK retries connection errors, 429 and 5xx twice.
    return anthropic.Anthropic(timeout=60.0, max_retries=2)


def ask(client: anthropic.Anthropic, *, system: str, user: str, schema: dict[str, Any], effort: str) -> ModelAnswer:
    try:
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
        )
    except anthropic.AuthenticationError as e:
        raise ModelError("not_configured") from e
    except anthropic.PermissionDeniedError as e:
        raise ModelError("not_configured") from e
    except anthropic.RateLimitError as e:
        raise ModelError("provider_busy") from e
    except anthropic.OverloadedError as e:
        raise ModelError("provider_busy") from e
    except anthropic.BadRequestError as e:
        raise ModelError("provider_rejected") from e
    except anthropic.APIStatusError as e:
        raise ModelError("provider_error") from e
    except anthropic.APITimeoutError as e:
        raise ModelError("provider_timeout") from e
    except anthropic.APIConnectionError as e:
        raise ModelError("provider_unreachable") from e

    if response.stop_reason == "refusal":
        raise ModelError("refused", response.usage)
    if response.stop_reason == "max_tokens":
        raise ModelError("too_long", response.usage)
    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is None:
        raise ModelError("bad_output", response.usage)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise ModelError("bad_output", response.usage) from e
    if not isinstance(data, dict):
        raise ModelError("bad_output", response.usage)
    return ModelAnswer(data=data, usage=response.usage)
