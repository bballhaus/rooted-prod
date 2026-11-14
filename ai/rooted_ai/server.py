"""Rooted's AI service: one HTTP door for every agent task, plus the Slack
connection (decisions 0016, 0017). Every failure is a stable error code the
app shows a message for; nothing here invents a fallback answer.
"""

from __future__ import annotations

import json
import time
from urllib.parse import urlencode
from dataclasses import dataclass, field
from typing import Any, Callable

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from . import slack
from .auth import AuthUnavailable
from .claude import ModelError, ask
from .config import Settings
from .limits import Limits, Store, cost_usd, worst_case_usd
from .tasks import SLACK_TASKS, TASKS, BadAnswer, BadPayload

MAX_BODY_BYTES = 512_000
REVOKED = ("invalid_auth", "token_revoked", "account_inactive")


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

    # Slack gives an app one bot token per workspace, so it's stored once per
    # workspace (slack-team:<id>) with the Rooted people using it, and each
    # person's record (slack:<user>) points at their workspace.
    def slack_token(user_id: str) -> str | None:
        mine = deps.store.get(f"slack:{user_id}") or {}
        team = deps.store.get(f"slack-team:{mine.get('teamId')}") or {}
        return team.get("token") if user_id in team.get("users", []) else None

    def forget_slack(user_id: str, revoke: bool) -> None:
        mine = deps.store.pop(f"slack:{user_id}") or {}
        key = f"slack-team:{mine.get('teamId')}"
        team = deps.store.get(key)
        if not team:
            return
        users = [u for u in team.get("users", []) if u != user_id]
        if users and revoke:
            deps.store.put(key, {**team, "users": users})  # others still use it; keep the token
            return
        deps.store.pop(key)
        if revoke:
            try:
                deps.slack_api.call("auth.revoke", team["token"])
            except slack.SlackError:
                pass  # the token is gone from Rooted either way

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"ok": True}

    @app.post("/agent")
    async def agent(request: Request) -> JSONResponse:
        raw = await request.body()
        # Sign-in checks, Slack reads and Claude calls block; run them off the
        # event loop so one slow call doesn't hold up everyone on this container.
        return await run_in_threadpool(handle_agent, request, raw)

    def handle_agent(request: Request, raw: bytes) -> JSONResponse:
        user_id = signed_in(request)
        if isinstance(user_id, JSONResponse):
            return user_id
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
                if e.code in REVOKED:
                    forget_slack(user_id, revoke=False)
                    return fail(502, "slack_token_revoked")
                return fail(502, "slack_error")

        try:
            user_message = task.build(payload)
        except BadPayload:
            return fail(400, "bad_payload")
        # Set aside the worst case first, so calls at the same moment can't all
        # slip under the daily cap; then settle what the call really cost.
        reserved = worst_case_usd(len(task.system) + len(user_message), task.max_tokens)
        if not limits.reserve(reserved):
            log("budget_reached", task=name)
            return fail(503, "budget_reached")
        try:
            answer = ask(deps.claude, system=task.system, user=user_message, schema=task.schema, effort=task.effort, max_tokens=task.max_tokens)
        except ModelError as e:
            limits.settle(reserved, cost_usd(e.usage) if e.usage is not None else 0.0)
            log("task_failed", task=name, code=e.code)
            return fail(503 if e.code in ("not_configured", "provider_key") else 502, e.code)
        spent = cost_usd(answer.usage)
        limits.settle(reserved, spent)
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
        token = slack_token(user_id)
        if not saved or not token:
            return JSONResponse({"ok": True, "result": {"available": True, "connected": False}})
        try:
            channels = slack.list_channels(deps.slack_api, token)
        except slack.SlackError as e:
            if e.code in REVOKED:
                forget_slack(user_id, revoke=False)
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
        # Stores nothing: whoever's browser lands here isn't proven to be the
        # person who started the install. The app finishes it, signed in, at
        # /slack/complete.
        back = f"{deps.settings.app_origins[0] if deps.settings.app_origins else ''}/onboarding"
        if error:
            return RedirectResponse(f"{back}?slack=cancelled", status_code=302)
        if not code or not state:
            return RedirectResponse(f"{back}?slack=expired", status_code=302)
        return RedirectResponse(f"{back}?{urlencode({'slack_code': code, 'slack_state': state})}", status_code=302)

    @app.post("/slack/complete")
    async def slack_complete(request: Request) -> JSONResponse:
        try:
            body = await request.json()
        except json.JSONDecodeError:
            return fail(400, "bad_json")
        return await run_in_threadpool(finish_install, request, str(body.get("code", "")), str(body.get("state", "")))

    def finish_install(request: Request, code: str, state: str) -> JSONResponse:
        user_id = signed_in(request)
        if isinstance(user_id, JSONResponse):
            return user_id
        started_by = slack.read_state(deps.settings, state, deps.clock())
        if started_by is None:
            return fail(400, "slack_state_expired")
        if started_by != user_id:
            log("slack_state_mismatch")
            return fail(403, "slack_state_mismatch")
        try:
            install = slack.exchange_code(deps.slack_api, deps.settings, code)
        except slack.SlackError as e:
            log("slack_install_failed", code=e.code)
            return fail(502, "slack_error")
        key = f"slack-team:{install['teamId']}"
        team = deps.store.get(key) or {}
        users = [u for u in team.get("users", []) if u != user_id] + [user_id]
        deps.store.put(key, {"token": install["token"], "users": users})
        deps.store.put(f"slack:{user_id}", {"teamId": install["teamId"], "teamName": install["teamName"], "connectedAt": int(deps.clock())})
        log("slack_connected")
        return JSONResponse({"ok": True, "result": {"connected": True, "teamName": install["teamName"]}})

    @app.post("/slack/disconnect")
    def slack_disconnect(request: Request) -> JSONResponse:
        user_id = signed_in(request)
        if isinstance(user_id, JSONResponse):
            return user_id
        # Revokes the workspace's token only when nobody else in Rooted uses it.
        forget_slack(user_id, revoke=True)
        return JSONResponse({"ok": True, "result": {"connected": False}})

    return app
