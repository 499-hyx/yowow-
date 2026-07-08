import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORTABLE_PYTHON = path.join(ROOT, ".runtime", "python", "python.exe");
const PYTHON = process.env.YOWOW_PYTHON || (fs.existsSync(PORTABLE_PYTHON) ? PORTABLE_PYTHON : "python3");

function runHotspots(args) {
  return spawnSync(PYTHON, ["scripts/generate_hotspot_pool.py", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
  });
}

test("hotspot pool generator selftest passes without network", () => {
  const result = runHotspots(["--selftest"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /selftest passed/);
});

test("hotspot pool generator dry-run renders ops prompts without network", () => {
  const result = runHotspots([
    "acct-xiaozhu-edu-xhs",
    "--date",
    "2099-01-01",
    "--dry-run",
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /calling LLM for hotspot prompt:/);
  assert.match(result.stdout, /dry-run: would write broad=0 track=0/);
});
