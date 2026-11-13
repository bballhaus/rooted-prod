"""Who is calling: checks the Supabase access token the app sends (0015)."""

from __future__ import annotations

import hashlib
import time
from typing import Callable

import httpx

from .config import Settings


class AuthUnavailable(Exception):
    """Supabase couldn't be asked, so we can't tell who this is."""


CACHE_SECONDS = 60


def make_verifier(settings: Settings, http: httpx.Client, clock: Callable[[], float] = time.time) -> Callable[[str], str | None]:
    """Returns verify(token) -> the Supabase user id, or None when the token isn't a signed-in user.

    Asks Supabase Auth directly rather than checking the JWT locally, so the
    check follows whatever signing keys the project uses. Answers are cached
    for a minute per token.
    """
    cache: dict[str, tuple[str | None, float]] = {}

    def verify(token: str) -> str | None:
        if not token or not settings.supabase_url or not settings.supabase_anon_key:
            return None
        key = hashlib.sha256(token.encode()).hexdigest()
        hit = cache.get(key)
        now = clock()
        if hit and hit[1] > now:
            return hit[0]
        try:
            res = http.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
        except httpx.HTTPError as e:
            raise AuthUnavailable() from e
        if res.status_code in (401, 403):
            user_id = None
        elif res.status_code == 200:
            user_id = res.json().get("id") or None
        else:
            raise AuthUnavailable()
        cache[key] = (user_id, now + CACHE_SECONDS)
        return user_id

    return verify
