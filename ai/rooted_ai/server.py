"""Rooted's AI service: one HTTP door for every agent task, plus the Slack
connection (decisions 0016, 0017). Every failure is a stable error code the
app shows a message for; nothing here invents a fallback answer.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from . import slack
from .auth import AuthUnavailable
from .claude import ModelError, ask
from .config import Settings
from .limits import Limits, Store, cost_usd
from .tasks import SLACK_TASKS, TASKS, BadAnswer, BadPayload

MAX_BODY_BYTES = 512_000


@dataclass
class Deps:
    settings: Settings
    verify: Callable[[str], str | None]  # access token -> Supabase user id
    store: Store
    claude: Any  # anthropic.Anthropic, or a fake in tests
    slack_api: slack.SlackApi
    clock: Callable[[], float] = field(default=time.time)


def fail(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


def log(event: str, **fields: Any) -> None:
    # Never log payloads, answers or tokens: they hold people's words.
    print(json.dumps({"event": event, **fields}))


def create_app(deps: Deps) -> FastAPI:
    app = FastAPI(title="Rooted AI", docs_url=None, redoc_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(deps.settings.app_origins),
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["authorization", "content-type"],
    )
    limits = Limits(deps.store, deps.settings, deps.clock)

    def signed_in(request: Request) -> str | JSONResponse:
        token = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
        try:
            user_id = deps.verify(token)
        except AuthUnavailable:
            return fail(503, "auth_unavailable")
        return user_id or fail(401, "sign_in_required")

    def slack_token(user_id: str) -> str | None:
        return (deps.store.get(f"slack:{user_id}") or {}).get("token")

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"ok": True}

    @app.post("/agent")
    async def agent(request: Request) -> JSONResponse:
        user_id = signed_in(request)
        if isinstance(user_id, JSONResponse):
            return user_id
        raw = await request.body()
        if len(raw) > MAX_BODY_BYTES:
            return fail(413, "too_large")
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            return fail(400, "bad_json")
        name, payload = body.get("task"), body.get("payload")
        task = TASKS.get(name) if isinstance(name, str) else None
        if task is None or not isinstance(payload, dict):
            return fail(400, "unknown_task")
        if not limits.allow_call(user_id):
            return fail(429, "rate_limited")
        if not limits.budget_left():
            log("budget_reached", task=name)
            return fail(503, "budget_reached")

        token: str | None = None
        if name in SLACK_TASKS and (payload.get("source") or {}).get("kind") == "slack":
            token = slack_token(user_id)
            if not token:
                return fail(409, "slack_not_connected")
            try:
                payload = {**payload, "messages": slack.gather(deps.slack_api, token, list(payload["source"].get("channelIds", [])), deps.clock)}
            except slack.SlackError as e:
                log("slack_failed", task=name, code=e.code)
                return fail(502, "slack_token_revoked" if e.code in ("invalid_auth", "token_revoked", "account_inactive") else "slack_error")

        try:
            user_message = task.build(payload)
        except BadPayload:
            return fail(400, "bad_payload")
        try:
            answer = ask(deps.claude, system=task.system, user=user_message, schema=task.schema, effort=task.effort)
        except ModelError as e:
            if e.usage is not None:
                limits.record_spend(cost_usd(e.usage))
            log("task_failed", task=name, code=e.code)
            return fail(503 if e.code == "not_configured" else 502, e.code)
        spent = cost_usd(answer.usage)
        limits.record_spend(spent)
        try:
            result = task.check(answer.data, payload)
        except BadAnswer:
            log("task_failed", task=name, code="bad_output", usd=round(spent, 5))
            return fail(502, "bad_output")
        if token and name == "brief":
            slack.add_permalinks(deps.slack_api, token, [i for i in result["items"] if i["kind"] == "message"])
        elif token and name == "spotDecisions":
            slack.add_permalinks(deps.slack_api, token, [e for s in result["suggestions"] for e in s["evidence"]])
        log("task_done", task=name, usd=round(spent, 5))
        return JSONResponse({"ok": True, "result": result})

    # ── Slack (0017) ─────────────────────────────────────────────────────

    @app.get("/slack/status")
    def slack_status(request: Request) -> JSONResponse:
        user_id = signed_in(request)
        if isinstance(user_id, JSONResponse):
            return user_id
        if not deps.settings.slack_configured:
            return JSONResponse({"ok": True, "result": {"available": False, "connected": False}})
        saved = deps.store.get(f"slack:{user_id}")
        if not saved:
            return JSONResponse({"ok": True, "result": {"available": True, "connected": False}})
        try:
            channels = slack.list_channels(deps.slack_api, saved["token"])
        except slack.SlackError as e:
            if e.code in ("invalid_auth", "token_revoked", "account_inactive"):
                deps.store.pop(f"slack:{user_id}")
                return JSONResponse({"ok": True, "result": {"available": True, "connected": False, "revoked": True}})
            return fail(502, "slack_error")
        return JSONResponse(
            {
                "ok": True,
                "result": {
                    "available": True,
                    "connected": True,
                    "teamName": saved.get("teamName", ""),
                    "connectedAt": saved.get("connectedAt"),
                    "channels": [{"id": c["id"], "name": c["name"], "memberCount": c["memberCount"]} for c in channels],
                },
            }
        )

    @app.post("/slack/install")
    def slack_install(request: Request) -> JSONResponse:
        user_id = signed_in(request)
        if isinstance(user_id, JSONResponse):
            return user_id
        if not deps.settings.slack_configured:
            return fail(503, "slack_not_configured")
        return JSONResponse({"ok": True, "result": {"url": slack.install_url(deps.settings, user_id, deps.clock())}})

    @app.get("/slack/callback")
    def slack_callback(code: str = "", state: str = "", error: str = "") -> RedirectResponse:
        back = f"{deps.settings.app_origins[0] if deps.settings.app_origins else ''}/onboarding"
        if error:
            return RedirectResponse(f"{back}?slack=cancelled", status_code=302)
        user_id = slack.read_state(deps.settings, state, deps.clock())
        if not user_id or not code:
            return RedirectResponse(f"{back}?slack=expired", status_code=302)
        try:
            install = slack.exchange_code(deps.slack_api, deps.settings, code)
        except slack.SlackError as e:
            log("slack_install_failed", code=e.code)
            return RedirectResponse(f"{back}?slack=error", status_code=302)
        deps.store.put(f"slack:{user_id}", {**install, "connectedAt": int(deps.clock())})
        log("slack_connected")
        return RedirectResponse(f"{back}?slack=connected", status_code=302)

    @app.post("/slack/disconnect")
    def slack_disconnect(request: Request) -> JSONResponse:
        user_id = signed_in(request)
        if isinstance(user_id, JSONResponse):
            return user_id
        saved = deps.store.pop(f"slack:{user_id}")
        if saved:
            try:
                deps.slack_api.call("auth.revoke", saved["token"])
            except slack.SlackError:
                pass  # the token is gone from Rooted either way
        return JSONResponse({"ok": True, "result": {"connected": False}})

    return app
