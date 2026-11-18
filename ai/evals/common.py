"""Shared bits for the eval runners: the client, what's under test, and output."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from rooted_ai.claude import MODEL

AI_DIR = Path(__file__).resolve().parents[1]
REPORTS = AI_DIR / "evals" / "reports"

BOOL = {"type": "boolean"}


def make_client() -> Any:
    import anthropic

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("Set ANTHROPIC_API_KEY to run the evals (they call Claude and cost money).")
    # Longer than the service's 50 s: the judge reads a lot and nobody is waiting on a page.
    return anthropic.Anthropic(timeout=180.0, max_retries=2)


def prompt_version() -> str:
    """A short hash of the task prompts and checks, so a report says exactly what it tested."""
    return hashlib.sha256((AI_DIR / "rooted_ai" / "tasks.py").read_bytes()).hexdigest()[:10]


def eval_version() -> str:
    """A short hash of the eval code (scenarios, checks, corpus, scoring), which can change without the prompts."""
    h = hashlib.sha256()
    for path in sorted((AI_DIR / "evals").glob("*.py")):
        h.update(path.name.encode() + path.read_bytes())
    return h.hexdigest()[:10]


def git_commit() -> str:
    if os.environ.get("ROOTED_EVAL_COMMIT"):  # set by modal_run.py, where there's no git checkout
        return os.environ["ROOTED_EVAL_COMMIT"]
    try:
        head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=AI_DIR, capture_output=True, text=True, check=True).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain", "--", "."], cwd=AI_DIR, capture_output=True, text=True, check=True).stdout.strip()
        return head + ("-dirty" if dirty else "")
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def header(title: str, extra: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": title,
        "ranAt": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "modelUnderTest": MODEL,
        "promptVersion": prompt_version(),
        "evalVersion": eval_version(),
        "commit": git_commit(),
        **extra,
    }


def write(name: str, report: dict[str, Any], markdown: str, out: Path = REPORTS) -> tuple[Path, Path]:
    out.mkdir(parents=True, exist_ok=True)
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    j = out / f"{day}-{name}.json"
    m = out / f"{day}-{name}.md"
    j.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    m.write_text(markdown)
    return j, m


def clip(s: str, n: int = 280) -> str:
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[: n - 1] + "…"


def md_escape(s: str) -> str:
    return clip(s).replace("|", "\\|")
