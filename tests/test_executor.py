import json
import tempfile
import unittest
from pathlib import Path
from executor.run_task import TASKS, run, catalog_health

class TestExecutor(unittest.TestCase):
    def test_health(self):
        self.assertTrue(catalog_health()["default_deny"])

    def test_allowlist(self):
        self.assertEqual(set(TASKS), {"catalog-health", "script-smoke", "macro-demo"})

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
