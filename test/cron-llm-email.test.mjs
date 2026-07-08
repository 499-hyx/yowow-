import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORTABLE_PYTHON = path.join(ROOT, ".runtime", "python", "python.exe");
const PYTHON = process.env.YOWOW_PYTHON || (fs.existsSync(PORTABLE_PYTHON) ? PORTABLE_PYTHON : "python3");

function runCron(args) {
  return spawnSync(PYTHON, ["scripts/cron_llm_email.py", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
  });
}

test("cron LLM email selftest passes without network", () => {
  const result = runCron(["--selftest"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /selftest passed/);
});

test("cron LLM email can render deterministic dry-run", () => {
  const result = runCron(["--dry-run", "--no-llm", "--accounts", "acct-xiaozhu-edu-xhs", "--date", "2099-01-01"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Subject:/);
  assert.match(result.stdout, /acct-xiaozhu-edu-xhs/);
});

test("cron LLM email supports doubao provider alias in selftest path", () => {
  const result = spawnSync(PYTHON, ["scripts/cron_llm_email.py", "--selftest"], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      LLM_PROVIDER: "doubao",
      PYTHONIOENCODING: "utf-8",
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /selftest passed/);
});
