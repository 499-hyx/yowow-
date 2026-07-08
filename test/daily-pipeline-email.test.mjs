import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORTABLE_PYTHON = path.join(ROOT, ".runtime", "python", "python.exe");
const PYTHON = process.env.YOWOW_PYTHON || (fs.existsSync(PORTABLE_PYTHON) ? PORTABLE_PYTHON : "python3");

function runDaily(args) {
  return spawnSync(PYTHON, ["scripts/daily_pipeline_email.py", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
  });
}

test("daily pipeline email selftest passes without network", () => {
  const result = runDaily(["--selftest"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /selftest passed/);
});

test("daily pipeline dry-run prints full command sequence and email preview", () => {
  const result = runDaily([
    "--dry-run",
    "--date",
    "2026-07-07",
    "--accounts",
    "acct-xiaozhu-edu-xhs",
    "--email-to",
    "cathy.hu.eng@gmail.com",
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stdout, /calling LLM for hotspot prompt:/);
  assert.doesNotMatch(result.stdout, /dry-run: would write broad=0 track=0/);
  assert.match(result.stdout, /make-prompt.py acct-xiaozhu-edu-xhs .* --step match/);
  assert.match(result.stdout, /answer.py acct-xiaozhu-edu-xhs .* --step generate/);
  assert.match(result.stdout, /ingest.py acct-xiaozhu-edu-xhs/);
  assert.match(result.stdout, /Subject:/);
});

test("daily pipeline hotspot generation is explicit opt-in", () => {
  const result = runDaily([
    "--dry-run",
    "--generate-hotspots",
    "--date",
    "2026-07-07",
    "--accounts",
    "acct-xiaozhu-edu-xhs",
    "--email-to",
    "cathy.hu.eng@gmail.com",
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /calling LLM for hotspot prompt:/);
  assert.match(result.stdout, /dry-run: would write broad=0 track=0/);
});
