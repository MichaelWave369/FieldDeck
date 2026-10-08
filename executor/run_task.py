#!/usr/bin/env python3
"""Fixed, side-effect-free execution examples for FieldDeck v0.1."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "public" / "fielddeck.manifest.json"

def catalog_health():
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    actions = data["actions"]
    ids = [a["id"] for a in actions]
    assert len(ids) == len(set(ids)), "Duplicate IDs"
    assert data["execution_policy"]["default"] == "deny"
    assert data["execution_policy"]["freeform_shell"] is False
    assert data["execution_policy"]["require_authenticated_runner"] is True
    for action in actions:
        assert action["kind"] in ("workflow", "copy", "link", "export", "future")
        if action["kind"] == "workflow":
            assert action["task"] in TASKS
    return {"entries": len(ids), "unique_ids": True, "default_deny": True}

def script_smoke():
    payload = b"fielddeck:approved-smoke-test:v1"
    return {"sha256": hashlib.sha256(payload).hexdigest(), "bytes": len(payload), "network_required": False}

def macro_demo():
    steps = [
        {"step": "load_catalog", "entries": len(json.loads(MANIFEST.read_text())["actions"])},
        {"step": "check_policy", "default": "deny"},
        {"step": "write_receipt", "status": "ok"}
    ]
    return {"steps": steps, "completed_steps": len(steps), "external_side_effects": False}

TASKS = {"catalog-health": catalog_health, "script-smoke": script_smoke, "macro-demo": macro_demo}

def run(task_id, output):
    if task_id not in TASKS:
        raise ValueError("Not allowlisted: " + repr(task_id))
    receipt = {
        "schema_version": "0.1.0", "task_id": task_id, "status": "PASS",
        "executed_at_utc": datetime.now(timezone.utc).isoformat(),
        "github_run_id": os.environ.get("GITHUB_RUN_ID"),
        "request_channel": os.environ.get("FIELDDECK_REQUEST_CHANNEL", "local-or-manual"),
        "request_issue": os.environ.get("FIELDDECK_ISSUE_NUMBER"),
        "requested_by": os.environ.get("FIELDDECK_REQUESTER"),
        "runner": "github-actions-or-local-cli", "result": TASKS[task_id](),
        "note": "Verify receipt provenance using the GitHub Actions run."
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return receipt

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True, choices=sorted(TASKS))
    parser.add_argument("--output", type=Path, default=Path("receipts/receipt.json"))
    args = parser.parse_args()
    print(json.dumps(run(args.task, args.output), indent=2))

if __name__ == "__main__":
    main()
