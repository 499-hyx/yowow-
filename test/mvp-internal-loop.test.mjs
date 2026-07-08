import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const ROOT = process.cwd();
const DATE = "2099-02-03";
const TRACK_ID = "mvp-internal-paused-track";
const ACCOUNT_ID = "acct-mvp-internal-paused";
const LEGACY_STATUS_ACCOUNT_ID = "acct-mvp-internal-legacy-status";
const HOTSPOT_ID = "hs-mvp-internal-001";
const PORTABLE_PYTHON = path.join(ROOT, ".runtime", "python", "python.exe");
const PYTHON = process.env.YOWOW_PYTHON || (fs.existsSync(PORTABLE_PYTHON) ? PORTABLE_PYTHON : "python3");

function abs(file) {
  return path.join(ROOT, file);
}

function writeJson(file, data) {
  const target = abs(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
}

function writeText(file, text) {
  const target = abs(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), "utf-8"));
}

function rm(file) {
  fs.rmSync(abs(file), { recursive: true, force: true });
}

function run(command, args) {
  return spawnSync(command === "python3" ? PYTHON : command, args, {
    cwd: ROOT,
    encoding: "utf-8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
}

function track() {
  return {
    track_id: TRACK_ID,
    track_name: "MVP Internal Paused Track",
    status: "paused",
    daily_search_question: "mvp internal only: choose practical consumer-product hotspots",
    track_memory: {
      mvp_internal_only: true,
      needs_human_review: true,
      core_concern: ["daily reliability", "practical product value"],
    },
    decision_layer: {
      mvp_internal_only: true,
      strong_pick: "Fits the product value naturally.",
      maybe: "Has a usable but narrow product angle.",
      skip: "Would require forcing the topic.",
    },
    analysis_layer: {
      mvp_internal_only: true,
      name: "mvp_internal_analysis",
      framework: ["fact", "user problem", "natural product relation", "safe expression"],
    },
    output_channels: [ACCOUNT_ID],
    bridge: {
      internal_lens: "MVP internal test lens, never user-facing",
      external_vocab: ["daily reliability", "practical value"],
      forbidden_terms: ["far transfer", "OOD", "范式转移"],
      search_directions: ["mvp internal only"],
    },
  };
}

function account(overrides = {}) {
  return {
    account_id: ACCOUNT_ID,
    tenant_id: "tenant-mvp-internal",
    display_name: "MVP Internal Account",
    track_id: TRACK_ID,
    platform_id: "douyin",
    positioning_id: "boss",
    created_at: `${DATE}T00:00:00Z`,
    memory: {
      product_value: "A practical product that saves time every morning.",
      proof_assets: ["demo footage"],
      anxiety_anchors: ["morning rush"],
      commercial_goal: ["direct sales"],
      extra_forbidden_terms: [],
    },
    ...overrides,
  };
}

function hotspot() {
  return {
    hotspot_id: HOTSPOT_ID,
    date: DATE,
    title: "Practical summer product discussion rises",
    summary: "A public-pool fixture about practical consumer products.",
    heat_score_10: 6.5,
    platforms: ["douyin"],
  };
}

function secondHotspot() {
  return {
    hotspot_id: "hs-mvp-internal-002",
    date: DATE,
    title: "Second practical discussion",
    summary: "A second fixture that should survive match filtering.",
    heat_score_10: 5.5,
    platforms: ["douyin"],
  };
}

function validGenerate() {
  return {
    hotspot_id: HOTSPOT_ID,
    track_id: TRACK_ID,
    platform_id: "douyin",
    positioning_id: "boss",
    relevance_score: 7,
    naturalness_score: 7,
    recommendation: "maybe",
    forced_flag: false,
    skip_reason: null,
    bridge_paths: [
      {
        path_id: "p1",
        phenomenon: "People are talking about whether practical products really help in daily routines.",
        real_problem: "Users want to spend money on something that visibly saves time.",
        track_relation: "This can connect to a grooming tool only if it stays on daily efficiency.",
        product_value_support: "The product value is a faster and more reliable morning routine.",
        platform_expression: "Use a short boss-style Douyin script with one practical checklist.",
      },
      {
        path_id: "p2",
        phenomenon: "Product practicality is being compared with empty marketing.",
        real_problem: "Users worry that a purchase sounds useful but does not change their day.",
        track_relation: "A grooming product must prove it helps before going out.",
        product_value_support: "The value is less friction before work or meetings.",
        platform_expression: "Start with the cost of wasting ten minutes every morning.",
      },
      {
        path_id: "p3",
        phenomenon: "People are interested in simple tools that handle everyday discomfort.",
        real_problem: "The user wants one decision rule instead of more choices.",
        track_relation: "A razor angle is natural when the point is dependable grooming.",
        product_value_support: "The value is a repeatable clean result, not a vague image promise.",
        platform_expression: "Make it a three-point buying standard for short video.",
      },
    ],
    chosen_path_id: "p1",
    content: {
      topic: "Practical products and morning efficiency",
      title: "Morning grooming should save time",
      body_or_script: "A useful product is not the one with the loudest story. It is the one that saves you time every morning and makes the result repeatable.",
    },
    external_terms_check: true,
  };
}

function writeFixtures() {
  writeJson(`config/tracks/${TRACK_ID}.json`, track());
  writeJson(`data/accounts/${ACCOUNT_ID}.json`, account());
  writeJson(`data/hotspots/${DATE}.json`, [hotspot()]);
  writeJson(`data/hotspots/tracks/${TRACK_ID}/${DATE}.json`, [
    { ...hotspot(), track_smoke_note: "mvp_internal_only: copied from public pool fixture" },
  ]);
}

test.afterEach(() => {
  rm(`config/tracks/${TRACK_ID}.json`);
  rm(`data/accounts/${ACCOUNT_ID}.json`);
  rm(`data/accounts/${LEGACY_STATUS_ACCOUNT_ID}.json`);
  rm(`data/hotspots/${DATE}.json`);
  rm(`data/hotspots/tracks/${TRACK_ID}`);
  rm(`data/runs/${DATE}`);
  rm(`data/today/${ACCOUNT_ID}`);
  rm(`prompts/分析提示词/${TRACK_ID}`);
});

test("paused track can run in single-admin internal MVP mode and installs review-marked output", () => {
  writeFixtures();

  const preflight = run("python3", ["scripts/status.py", "--date", DATE, "--preflight", ACCOUNT_ID]);
  assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
  assert.match(preflight.stdout, /needs_human_review|MVP internal/i);

  const prompt = run("python3", [
    "scripts/make-prompt.py",
    ACCOUNT_ID,
    "--date",
    DATE,
    "--step",
    "match",
    "--no-print",
  ]);
  assert.equal(prompt.status, 0, prompt.stderr || prompt.stdout);
  assert.match(prompt.stdout + prompt.stderr, /needs_human_review|MVP internal/i);
  const matchPrompt = fs.readFileSync(abs(`data/runs/${DATE}/${ACCOUNT_ID}/prompts/match-${HOTSPOT_ID}.txt`), "utf-8");
  assert.match(matchPrompt, /热点可发判断 Skill/);
  assert.match(matchPrompt, /账号判断卡/);
  assert.doesNotMatch(matchPrompt, /## 赛道配置/);
  assert.doesNotMatch(matchPrompt, /"decision_layer"/);
  assert.doesNotMatch(matchPrompt, /MVP internal test lens/);

  writeJson(`data/runs/${DATE}/${ACCOUNT_ID}/_inbox/match-${HOTSPOT_ID}.json`, {
    hotspot_id: HOTSPOT_ID,
    tier: "maybe",
    relevance_score: 7,
    naturalness_score: 7,
    why_relevant: "It can test a practical-product angle without claiming formal approval.",
    skip_reason: null,
  });
  writeJson(`data/runs/${DATE}/${ACCOUNT_ID}/_inbox/generate-${HOTSPOT_ID}.json`, validGenerate());

  const ingest = run("python3", [
    "scripts/ingest.py",
    ACCOUNT_ID,
    `data/runs/${DATE}/${ACCOUNT_ID}/_inbox`,
    "--date",
    DATE,
  ]);
  assert.equal(ingest.status, 0, ingest.stderr || ingest.stdout);

  const today = readJson(`data/today/${ACCOUNT_ID}/${DATE}.json`);
  const latest = readJson(`data/today/${ACCOUNT_ID}/latest.json`);
  const manifest = readJson(`data/runs/${DATE}/${ACCOUNT_ID}/manifest.json`);
  assert.equal(latest.date, DATE);
  for (const doc of [today, latest, manifest]) {
    assert.equal(doc.needs_human_review, true);
    assert.equal(doc.formal_approval, false);
    assert.equal(doc.mvp_internal_only, true);
  }
  assert.equal(today.board.picks[0].needs_human_review, true);
  assert.equal(fs.existsSync(abs(`data/runs/${DATE}/${ACCOUNT_ID}/RUN-NOTE.md`)), true);
});

test("legacy account status does not block internal MVP runs", () => {
  writeFixtures();
  writeJson(`data/accounts/${LEGACY_STATUS_ACCOUNT_ID}.json`, account({
    account_id: LEGACY_STATUS_ACCOUNT_ID,
    display_name: "Legacy Status MVP Internal Account",
    status: "inactive",
  }));

  const result = run("python3", [
    "scripts/make-prompt.py",
    LEGACY_STATUS_ACCOUNT_ID,
    "--date",
    DATE,
    "--step",
    "match",
    "--no-print",
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(
    fs.existsSync(abs(`data/runs/${DATE}/${LEGACY_STATUS_ACCOUNT_ID}/prompts/match-${HOTSPOT_ID}.txt`)),
    true,
  );
});

test("generate prompts are created only for non-skip match results", () => {
  writeFixtures();
  writeJson(`data/hotspots/${DATE}.json`, [hotspot(), secondHotspot()]);
  writeJson(`data/runs/${DATE}/${ACCOUNT_ID}/_inbox/match-${HOTSPOT_ID}.json`, {
    hotspot_id: HOTSPOT_ID,
    tier: "skip",
    relevance_score: 2,
    naturalness_score: 2,
    why_relevant: "",
    skip_reason: "This fixture should not receive a generate prompt.",
  });
  writeJson(`data/runs/${DATE}/${ACCOUNT_ID}/_inbox/match-hs-mvp-internal-002.json`, {
    hotspot_id: "hs-mvp-internal-002",
    tier: "maybe",
    relevance_score: 7,
    naturalness_score: 7,
    why_relevant: "This fixture should receive a generate prompt.",
    skip_reason: null,
  });

  const result = run("python3", [
    "scripts/make-prompt.py",
    ACCOUNT_ID,
    "--date",
    DATE,
    "--step",
    "generate",
    "--no-print",
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(abs(`data/runs/${DATE}/${ACCOUNT_ID}/prompts/generate-${HOTSPOT_ID}.txt`)), false);
  assert.equal(fs.existsSync(abs(`data/runs/${DATE}/${ACCOUNT_ID}/prompts/generate-hs-mvp-internal-002.txt`)), true);
  assert.match(result.stdout, /generate prompts \(1 条\)/);
});

test("generate prompt includes the track-specific doctor analysis layer", () => {
  writeFixtures();
  writeText(
    `prompts/分析提示词/${TRACK_ID}/赛道分析.md`,
    [
      "# MVP 博士分析层",
      "",
      "DOCTOR_ANALYSIS_SENTINEL: use the six-step expert analysis before writing content.",
      "",
    ].join("\n"),
  );
  writeJson(`data/runs/${DATE}/${ACCOUNT_ID}/_inbox/match-${HOTSPOT_ID}.json`, {
    hotspot_id: HOTSPOT_ID,
    tier: "maybe",
    relevance_score: 7,
    naturalness_score: 7,
    why_relevant: "This fixture should receive a generate prompt with doctor analysis.",
    skip_reason: null,
  });

  const result = run("python3", [
    "scripts/make-prompt.py",
    ACCOUNT_ID,
    "--date",
    DATE,
    "--step",
    "generate",
    "--no-print",
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const promptText = fs.readFileSync(abs(`data/runs/${DATE}/${ACCOUNT_ID}/prompts/generate-${HOTSPOT_ID}.txt`), "utf-8");
  assert.match(promptText, /## 赛道博士分析层/);
  assert.match(promptText, /DOCTOR_ANALYSIS_SENTINEL/);
});

test("copy-paste prompts expose fixed JSON contracts with hotspot_id", () => {
  writeFixtures();

  const match = run("python3", [
    "scripts/make-prompt.py",
    ACCOUNT_ID,
    "--date",
    DATE,
    "--step",
    "match",
    "--no-print",
  ]);
  assert.equal(match.status, 0, match.stderr || match.stdout);
  const matchPrompt = fs.readFileSync(abs(`data/runs/${DATE}/${ACCOUNT_ID}/prompts/match-${HOTSPOT_ID}.txt`), "utf-8");
  assert.match(matchPrompt, new RegExp(`"hotspot_id": "${HOTSPOT_ID}"`));
  assert.match(matchPrompt, /只输出 JSON/);
  assert.match(matchPrompt, /JSON 数组/);
  assert.doesNotMatch(matchPrompt, /系统会自动保存到/);

  writeJson(`data/runs/${DATE}/${ACCOUNT_ID}/_inbox/match-${HOTSPOT_ID}.json`, {
    hotspot_id: HOTSPOT_ID,
    tier: "maybe",
    relevance_score: 7,
    naturalness_score: 7,
    why_relevant: "This fixture should receive a generate prompt.",
    skip_reason: null,
  });
  const generate = run("python3", [
    "scripts/make-prompt.py",
    ACCOUNT_ID,
    "--date",
    DATE,
    "--step",
    "generate",
    "--no-print",
  ]);
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  const generatePrompt = fs.readFileSync(abs(`data/runs/${DATE}/${ACCOUNT_ID}/prompts/generate-${HOTSPOT_ID}.txt`), "utf-8");
  assert.match(generatePrompt, new RegExp(`"hotspot_id": "${HOTSPOT_ID}"`));
  assert.match(generatePrompt, /只输出 JSON/);
  assert.match(generatePrompt, /JSON 数组/);
  assert.doesNotMatch(generatePrompt, /\/\/ ≥3 条/);
  assert.doesNotMatch(generatePrompt, /## 这条赛道（产品价值/);
});

test("ingest still rejects bad JSON and remains the install gate", () => {
  writeFixtures();
  const inbox = abs(`data/runs/${DATE}/${ACCOUNT_ID}/_bad-json`);
  fs.mkdirSync(inbox, { recursive: true });
  fs.writeFileSync(path.join(inbox, `match-${HOTSPOT_ID}.json`), "{not valid json\n");

  const result = run("python3", [
    "scripts/ingest.py",
    ACCOUNT_ID,
    `data/runs/${DATE}/${ACCOUNT_ID}/_bad-json`,
    "--date",
    DATE,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /JSON|ingest 失败/);

  const apiTodayRoute = fs.readFileSync(abs("app/api/today/route.ts"), "utf-8");
  assert.doesNotMatch(apiTodayRoute, /writeFile|atomic_write|fs\./);
  assert.match(fs.readFileSync(abs("scripts/ingest.py"), "utf-8"), /atomic_write_json\(dated_path/);
});
