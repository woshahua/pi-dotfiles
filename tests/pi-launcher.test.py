import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class LauncherTest(unittest.TestCase):
    def run_launcher(self, *args, failure=0):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stub = root / "mise"
            log = root / "calls.jsonl"
            stub.write_text("""#!/usr/bin/env python3
import json, os, sys
with open(os.environ['TEST_CALLS'], 'a') as file:
    file.write(json.dumps(sys.argv[1:]) + '\\n')
if 'upgrade' in sys.argv or 'install' in sys.argv:
    sys.exit(int(os.environ.get('TEST_FAILURE', '0')))
""")
            stub.chmod(0o755)
            env = {**os.environ, "PATH": f"{root}:{os.environ['PATH']}",
                   "TEST_CALLS": str(log), "TEST_FAILURE": str(failure)}
            result = subprocess.run(["bash", str(ROOT / "bin/pi"), *args],
                                    env=env, capture_output=True, text=True)
            calls = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
            return result, calls

    def test_default_update_uses_mise_and_keeps_old_version(self):
        result, calls = self.run_launcher("update")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls[0], ["-C", os.environ["HOME"], "upgrade", "--no-prune", "pi"])
        self.assertEqual(calls[-1][-3:], ["--", "pi", "--version"])

    def test_self_aliases(self):
        for flag in ["--self", "self", "pi"]:
            with self.subTest(flag=flag):
                result, calls = self.run_launcher("update", flag)
                self.assertEqual(result.returncode, 0)
                self.assertIn("upgrade", calls[0])

    def test_pass_through_keeps_arguments(self):
        for args in [[], ["--version"], ["a prompt with spaces"],
                     ["update", "--extensions"], ["update", "--models"],
                     ["update", "npm:some-package"], ["update", "--extension", "npm:test"],
                     ["update", "--help"], ["update", "--unknown"],
                     ["update", "--all", "--self"], ["update", "pi", "self"]]:
            with self.subTest(args=args):
                result, calls = self.run_launcher(*args)
                self.assertEqual(result.returncode, 0)
                self.assertEqual(calls, [["x", "pi", "--", "pi", *args]])

    def test_all_updates_extensions_with_trust_flag(self):
        result, calls = self.run_launcher("update", "--all", "--no-approve")
        self.assertEqual(result.returncode, 0)
        self.assertIn("upgrade", calls[0])
        self.assertEqual(calls[-1], ["x", "pi", "--", "pi", "update", "--extensions", "--no-approve"])

    def test_combined_flags(self):
        _, calls = self.run_launcher("update", "--self", "--extensions")
        self.assertIn("upgrade", calls[0])
        self.assertEqual(calls[-1][-2:], ["update", "--extensions"])

    def test_force_reinstalls_through_mise(self):
        result, calls = self.run_launcher("update", "--force")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(calls[0], ["-C", os.environ["HOME"], "install", "--force", "pi"])

    def test_failed_upgrade_does_not_claim_success_or_update_extensions(self):
        result, calls = self.run_launcher("update", "--all", failure=23)
        self.assertEqual(result.returncode, 23)
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
