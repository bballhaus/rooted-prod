"""Per-user rate limits and the daily spending cap.

State lives in a key-value store: a Modal Dict in production, a plain dict in
tests. Updates aren't atomic across containers, so both limits are best
effort: they bound bursts and the daily bill, not to the cent.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Callable, Protocol

from .config import Settings

# Claude Sonnet 5.5 list prices, US dollars per million tokens (0020). Its
# server-side fallback, Claude Sonnet 5, costs the same.
PRICE_PER_MTOK = {"input": 2.00, "output": 10.00, "cache_read": 0.20, "cache_write": 2.50}


class Store(Protocol):
    def get(self, key: str, default: Any = None) -> Any: ...
    def put(self, key: str, value: Any) -> None: ...
    def pop(self, key: str, default: Any = None) -> Any: ...


class MemoryStore:
    """A Store for tests and local runs."""

    def __init__(self) -> None:
        self.data: dict[str, Any] = {}

    def get(self, key: str, default: Any = None) -> Any:
        return self.data.get(key, default)

    def put(self, key: str, value: Any) -> None:
        self.data[key] = value

    def pop(self, key: str, default: Any = None) -> Any:
        return self.data.pop(key, default)


def cost_usd(usage: Any) -> float:
    """What one response cost, from its usage block."""

    def n(name: str) -> int:
        return int(getattr(usage, name, 0) or 0)

    return (
        n("input_tokens") * PRICE_PER_MTOK["input"]
        + n("output_tokens") * PRICE_PER_MTOK["output"]
        + n("cache_read_input_tokens") * PRICE_PER_MTOK["cache_read"]
        + n("cache_creation_input_tokens") * PRICE_PER_MTOK["cache_write"]
    ) / 1_000_000


class Limits:
    def __init__(self, store: Store, settings: Settings, clock: Callable[[], float] = time.time) -> None:
        self.store = store
        self.settings = settings
        self.clock = clock

    def _day(self) -> str:
        return datetime.fromtimestamp(self.clock(), tz=timezone.utc).strftime("%Y-%m-%d")

    def allow_call(self, user_id: str) -> bool:
        """Counts a call for this user; False once they're over the limit for the window."""
        now = self.clock()
        key = f"rate:{user_id}"
        recent = [t for t in self.store.get(key, []) if now - t < self.settings.window_seconds]
        if len(recent) >= self.settings.user_calls_per_window:
            self.store.put(key, recent)
            return False
        self.store.put(key, [*recent, now])
        return True

    def spent_today(self) -> float:
        return float(self.store.get(f"spend:{self._day()}", 0.0))

    def budget_left(self) -> bool:
        return self.spent_today() < self.settings.daily_budget_usd

    def record_spend(self, usd: float) -> None:
        key = f"spend:{self._day()}"
        self.store.put(key, float(self.store.get(key, 0.0)) + usd)

    def reserve(self, usd: float) -> bool:
        """Sets aside a call's worst-case cost before it runs, so calls made at
        the same moment can't all slip under the cap. False if it won't fit."""
        if self.spent_today() + usd > self.settings.daily_budget_usd:
            return False
        self.record_spend(usd)
        return True

    def settle(self, reserved: float, actual: float) -> None:
        """Swaps a reservation for what the call really cost."""
        self.record_spend(actual - reserved)


def worst_case_usd(prompt_chars: int, max_tokens: int) -> float:
    """An upper bound on one call's cost: about three characters per input
    token (generous for English) and every output token used."""
    return (prompt_chars / 3 * PRICE_PER_MTOK["input"] + max_tokens * PRICE_PER_MTOK["output"]) / 1_000_000
