import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from executor.run_task import TASKS, run, catalog_health, PRIMITIVES, APPROVED_SWEEP

class TestExecutor(unittest.TestCase):
    def test_health(self):
        self.assertTrue(catalog_health()["default_deny"])

    def test_allowlist(self):
        self.assertEqual(set(TASKS), {"catalog-health", "script-smoke", "macro-demo", "field-health-sweep"})

    def test_fixed_chain_steps_and_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            receipt = run("field-health-sweep", Path(tmp) / "receipt.json")
            result = receipt["result"]
            self.assertEqual(result["playbook_id"], "field-health-sweep")
            self.assertEqual([s["action_id"] for s in result["steps"]], list(APPROVED_SWEEP))
            self.assertEqual([s["status"] for s in result["steps"]], ["PASS"] * 3)
            self.assertEqual(result["completed_steps"], 3)

    def test_chain_fails_closed_and_preserves_partial_receipt(self):
        def fails():
            raise RuntimeError("do not publish this sensitive message")
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "failure.json"
            with patch.dict(PRIMITIVES, {"script-smoke": fails}):
                receipt = run("field-health-sweep", target)
            self.assertEqual(receipt["status"], "FAIL")
            self.assertEqual([s["status"] for s in receipt["result"]["steps"]], ["PASS", "FAIL"])
            self.assertNotIn("sensitive message", target.read_text())
            self.assertEqual(receipt["result"]["completed_steps"], 1)

    def test_reject_untrusted_task(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                run("arbitrary-command", Path(tmp) / "receipt.json")

    def test_receipt_for_each_task(self):
        with tempfile.TemporaryDirectory() as tmp:
            for task in TASKS:
                file = Path(tmp) / (task + ".json")
                receipt = run(task, file)
                self.assertEqual(receipt["status"], "PASS")
                self.assertEqual(json.loads(file.read_text())["task_id"], task)

if __name__ == "__main__":
    unittest.main()
