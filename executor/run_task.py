#!/usr/bin/env python3
"""Fixed, side-effect-free execution examples for FieldDeck v0.1."""
import argparse
import hashlib
import json
import os
from time import perf_counter
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

# Fixed primitives. A chain is a reviewed function, not a user-supplied script.
PRIMITIVES = {"catalog-health": catalog_health, "script-smoke": script_smoke, "macro-demo": macro_demo}
APPROVED_SWEEP = ("catalog-health", "script-smoke", "macro-demo")

def field_health_sweep():
    steps = []
    for action_id in APPROVED_SWEEP:
        started = perf_counter()
        try:
            result = PRIMITIVES[action_id]()
            steps.append({
                "position": len(steps) + 1,
                "action_id": action_id,
                "status": "PASS",
                "duration_ms": round((perf_counter() - started) * 1000, 3),
                "result": result,
            })
        except Exception as exc:
            # Do not leak exception messages or stack details in public receipts.
            steps.append({
                "position": len(steps) + 1,
                "action_id": action_id,
                "status": "FAIL",
                "duration_ms": round((perf_counter() - started) * 1000, 3),
                "error_type": type(exc).__name__,
            })
            break
    return {
        "status": "PASS" if len(steps) == len(APPROVED_SWEEP) and all(s["status"] == "PASS" for s in steps) else "FAIL",
        "playbook_id": "field-health-sweep",
        "steps": steps,
        "completed_steps": len([s for s in steps if s["status"] == "PASS"]),
        "expected_steps": len(APPROVED_SWEEP),
        "external_side_effects": False,
    }

TASKS = {**PRIMITIVES, "field-health-sweep": field_health_sweep}

def run(task_id, output):
    if task_id not in TASKS:
        raise ValueError("Not allowlisted: " + repr(task_id))
    result = TASKS[task_id]()
    status = result.get("status", "PASS")
    receipt = {
        "schema_version": "0.4.0", "task_id": task_id, "status": status,
        "executed_at_utc": datetime.now(timezone.utc).isoformat(),
        "github_run_id": os.environ.get("GITHUB_RUN_ID"),
        "request_channel": os.environ.get("FIELDDECK_REQUEST_CHANNEL", "local-or-manual"),
        "request_issue": os.environ.get("FIELDDECK_ISSUE_NUMBER"),
        "requested_by": os.environ.get("FIELDDECK_REQUESTER"),
        "runner": "github-actions-or-local-cli", "result": result,
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
    receipt = run(args.task, args.output)
    print(json.dumps(receipt, indent=2))
    if receipt["status"] != "PASS":
        raise SystemExit(1)

if __name__ == "__main__":
    main()
