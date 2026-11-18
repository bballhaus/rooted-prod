"""Run the evals on Modal with the rooted-anthropic secret, so the API key never
has to leave Modal. A one-off app: it doesn't touch the deployed service.

    python3 -m modal run ai/evals/modal_run.py                    # both evals
    python3 -m modal run ai/evals/modal_run.py --which scenarios  # or extraction

Reports are written to ai/evals/reports/ on your machine. Each run costs real
money (capped by --max-usd per eval).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import modal

AI = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI))  # so Modal can find rooted_ai and evals to ship

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_requirements(str(AI / "requirements.txt"))
    .add_local_python_source("rooted_ai", "evals")
)

app = modal.App("rooted-evals", image=image)


@app.function(secrets=[modal.Secret.from_name("rooted-anthropic")], timeout=3600)
def run(which: str, max_usd: float, commit: str) -> dict[str, str]:
    import os
    import runpy
    import sys

    os.environ["ROOTED_EVAL_COMMIT"] = commit
    sys.argv = [which, "--max-usd", str(max_usd)]
    runpy.run_module(f"evals.run_{which}", run_name="__main__")
    from evals.common import REPORTS

    return {p.name: p.read_text() for p in REPORTS.glob(f"*-{which}.*")}


@app.local_entrypoint()
def main(which: str = "both", max_usd: float = 15.0) -> None:
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=AI, capture_output=True, text=True).stdout.strip() or "unknown"
    if subprocess.run(["git", "status", "--porcelain", "--", "."], cwd=AI, capture_output=True, text=True).stdout.strip():
        commit += "-dirty"
    out = AI / "evals" / "reports"
    out.mkdir(parents=True, exist_ok=True)
    kinds = ["scenarios", "extraction"] if which == "both" else [which]
    for files in run.starmap([(k, max_usd, commit) for k in kinds]):
        for name, text in files.items():
            (out / name).write_text(text)
            print(f"wrote {out / name}")
