import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const ROOT = process.cwd();
const DATE = "2099-01-17";
const ACCOUNT_ID = "acct-status-preflight-test";
const LEGACY_STATUS_ACCOUNT_ID = "acct-status-preflight-legacy-status-test";
const TRACK_ID = "status-preflight-track";
const PAUSED_TRACK_ID = "status-preflight-paused-track";
const PORTABLE_PYTHON = path.join(ROOT, ".runtime", "python", "python.exe");
const PYTHON = process.env.YOWOW_PYTHON || (fs.existsSync(PORTABLE_PYTHON) ? PORTABLE_PYTHON : "python3");

function filePath(file) {
  return path.join(ROOT, file);
}

function writeJson(file, data) {
  const target = filePath(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
}

function remove(file) {
  fs.rmSync(filePath(file), { force: true, recursive: true });
}

function runStatus(args) {
  return spawnSync(PYTHON, ["scripts/status.py", ...args], {
    cwd: ROOT,
    encoding: "utf-8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
}

function baseTrack(overrides = {}) {
  return {
    track_id: TRACK_ID,
    track_name: "Status Preflight Test Track",
    status: "approved",
    daily_search_question: "smoke test only search question",
    track_memory: { core_concern: ["fixture"] },
    decision_layer: { strong_pick: "fixture", maybe: "fixture", skip: "fixture" },
    analysis_layer: { name: "fixture", framework: ["fixture"] },
    output_channels: [ACCOUNT_ID],
    ...overrides,
  };
}

function baseAccount(overrides = {}) {
  return {
    account_id: ACCOUNT_ID,
    display_name: "Status Preflight Test Account",
    track_id: TRACK_ID,
    platform_id: "douyin",
    positioning_id: "boss",
    created_at: `${DATE}T00:00:00Z`,
    ...overrides,
  };
}

function writeBaseFixtures() {
  writeJson(`config/tracks/${TRACK_ID}.json`, baseTrack());
  writeJson(`data/accounts/${ACCOUNT_ID}.json`, baseAccount());
  writeJson(`data/hotspots/${DATE}.json`, [
    { hotspot_id: "hs-status-preflight-1", title: "preflight fixture", summary: "fixture", platforms: ["douyin"] },
  ]);
  writeJson(`data/hotspots/tracks/${TRACK_ID}/${DATE}.json`, [
    { hotspot_id: "hs-status-preflight-1", title: "preflight fixture", summary: "fixture", platforms: ["douyin"] },
  ]);
}

test.afterEach(() => {
  remove(`config/tracks/${TRACK_ID}.json`);
  remove(`config/tracks/${PAUSED_TRACK_ID}.json`);
  remove(`data/accounts/${ACCOUNT_ID}.json`);
  remove(`data/accounts/${LEGACY_STATUS_ACCOUNT_ID}.json`);
  remove(`data/hotspots/${DATE}.json`);
  remove(`data/hotspots/tracks/${TRACK_ID}`);
  remove(`data/hotspots/tracks/${PAUSED_TRACK_ID}`);
  remove(`data/runs/${DATE}`);
  remove(`data/today/${ACCOUNT_ID}`);
});

test("preflight does not require prompts, inbox, raw, or today outputs", () => {
  writeBaseFixtures();

  const result = runStatus(["--date", DATE, "--preflight", ACCOUNT_ID]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Preflight status/);
  assert.doesNotMatch(result.stdout, /data\/runs\/.*\/prompts/);
  assert.doesNotMatch(result.stdout, /_inbox/);
  assert.doesNotMatch(result.stdout, /raw/);
  assert.doesNotMatch(result.stdout, /latest/);
});

test("preflight fails when public hotspot pool is missing", () => {
  writeBaseFixtures();
  remove(`data/hotspots/${DATE}.json`);

  const result = runStatus(["--date", DATE, "--preflight", ACCOUNT_ID]);

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /缺当天公共热点池/);
});

test("preflight fails when track hotspot pool is missing", () => {
  writeBaseFixtures();
  remove(`data/hotspots/tracks/${TRACK_ID}/${DATE}.json`);

  const result = runStatus(["--date", DATE, "--preflight", ACCOUNT_ID]);

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /缺赛道池/);
});

test("preflight ignores legacy account status", () => {
  writeBaseFixtures();
  writeJson(`data/accounts/${LEGACY_STATUS_ACCOUNT_ID}.json`, baseAccount({
    account_id: LEGACY_STATUS_ACCOUNT_ID,
    status: "inactive",
  }));

  const result = runStatus(["--date", DATE, "--preflight", LEGACY_STATUS_ACCOUNT_ID]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /账号可运行/);
  assert.match(result.stdout, /status 字段不再作为跑批开关/);
});

test("preflight warns when track is paused without formal approval", () => {
  writeJson(`config/tracks/${PAUSED_TRACK_ID}.json`, baseTrack({
    track_id: PAUSED_TRACK_ID,
    status: "paused",
    output_channels: [ACCOUNT_ID],
  }));
  writeJson(`data/accounts/${ACCOUNT_ID}.json`, baseAccount({ track_id: PAUSED_TRACK_ID }));
  writeJson(`data/hotspots/${DATE}.json`, [
    { hotspot_id: "hs-status-preflight-1", title: "preflight fixture", summary: "fixture", platforms: ["douyin"] },
  ]);
  writeJson(`data/hotspots/tracks/${PAUSED_TRACK_ID}/${DATE}.json`, [
    { hotspot_id: "hs-status-preflight-1", title: "preflight fixture", summary: "fixture", platforms: ["douyin"] },
  ]);

  const result = runStatus(["--date", DATE, "--preflight", ACCOUNT_ID]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /status=paused/);
  assert.match(result.stdout, /needs_human_review|MVP internal/i);
});

test("preflight labels temporary smoke authorization when track is explicitly marked", () => {
  writeJson(`config/tracks/${TRACK_ID}.json`, baseTrack({
    smoke_note: "temporary smoke approval only; restore to paused after local run",
  }));
  writeJson(`data/accounts/${ACCOUNT_ID}.json`, baseAccount());
  writeJson(`data/hotspots/${DATE}.json`, [
    { hotspot_id: "hs-status-preflight-1", title: "preflight fixture", summary: "fixture", platforms: ["douyin"] },
  ]);
  writeJson(`data/hotspots/tracks/${TRACK_ID}/${DATE}.json`, [
    { hotspot_id: "hs-status-preflight-1", title: "preflight fixture", summary: "fixture", platforms: ["douyin"] },
  ]);

  const result = runStatus(["--date", DATE, "--preflight", ACCOUNT_ID]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /SMOKE ONLY/);
  assert.match(result.stdout, /not formal approval|temporary smoke approval only/);
});

test("full status still checks installed today/latest outputs after ingest", () => {
  const result = runStatus(["--date", "2026-06-29"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /today dated 存在: data\/today\/acct-xiaozhu-edu-xhs\/2026-06-29\.json/);
  assert.match(result.stdout, /today latest 存在: data\/today\/acct-xiaozhu-edu-xhs\/latest\.json/);
});
