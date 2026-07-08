import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const ROOT = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf-8");
}

async function importTs(file) {
  const source = read(file);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: file,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

function tempProject() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ops-workbench-"));
  fs.mkdirSync(path.join(base, "prompts", "公共热点"), { recursive: true });
  fs.mkdirSync(path.join(base, "prompts", "赛道热点"), { recursive: true });
  fs.mkdirSync(path.join(base, "config", "tracks"), { recursive: true });
  fs.mkdirSync(path.join(base, "data", "accounts"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "prompts", "公共热点", "平台原生全网热点.md"),
    "今天是 {date}。公共池。",
    "utf-8",
  );
  fs.writeFileSync(
    path.join(base, "prompts", "公共热点", "终极雷达热点.md"),
    "今天是 {date}。终极雷达。",
    "utf-8",
  );
  fs.writeFileSync(
    path.join(base, "prompts", "赛道热点", "通用赛道热点搜索.md"),
    "{date} / {track} / {search_brief} / {directions}",
    "utf-8",
  );
  fs.writeFileSync(
    path.join(base, "config", "tracks", "education-yowow.json"),
    JSON.stringify({
      track_id: "education-yowow",
      track_name: "教育赛道",
      status: "approved",
      bridge: {
        search_brief: "找教育热点",
        search_directions: ["家长争议", "AI 和孩子"],
      },
    }),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(base, "data", "accounts", "acct-xiaozhu-edu-xhs.json"),
    JSON.stringify({
      account_id: "acct-xiaozhu-edu-xhs",
      display_name: "小猪",
      status: "active",
      track_id: "education-yowow",
    }),
    "utf-8",
  );
  return base;
}

test("ops prompt renderers expose multiple copy-ready broad prompts and track search without a neutralize step", async () => {
  const ops = await importTs("lib/ops-workbench.ts");
  const base = tempProject();

  const prompts = ops.renderHotspotPrompts({
    base,
    date: "2026-06-30",
    accountId: "acct-xiaozhu-edu-xhs",
  });

  assert.equal(prompts.broad.includes("2026-06-30"), true);
  assert.deepEqual(
    prompts.broadPrompts.map((item) => item.title),
    ["平台原生全网热点", "终极雷达热点"],
  );
  assert.equal(prompts.broadPrompts[1].text.includes("终极雷达"), true);
  assert.equal(prompts.search.includes("教育赛道"), true);
  assert.equal(prompts.search.includes("家长争议"), true);
  assert.equal(Object.hasOwn(prompts, "neutralize"), false);
});

test("ops prefers track-specific search prompt and falls back to generic search prompt", async () => {
  const ops = await importTs("lib/ops-workbench.ts");
  const base = tempProject();
  fs.mkdirSync(path.join(base, "prompts", "赛道热点", "education-yowow"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "prompts", "赛道热点", "education-yowow", "热点搜索.md"),
    "专属赛道搜索 {date} / {track} / {search_brief} / {directions}",
    "utf-8",
  );

  const prompts = ops.renderHotspotPrompts({
    base,
    date: "2026-06-30",
    accountId: "acct-xiaozhu-edu-xhs",
  });

  assert.equal(prompts.search.includes("专属赛道搜索"), true);
  assert.equal(prompts.search.includes("教育赛道"), true);
  assert.equal(prompts.search.includes("家长争议"), true);

  fs.rmSync(path.join(base, "prompts", "赛道热点", "education-yowow"), { recursive: true, force: true });
  const fallback = ops.renderHotspotPrompts({
    base,
    date: "2026-06-30",
    accountId: "acct-xiaozhu-edu-xhs",
  });

  assert.equal(fallback.search.includes("专属赛道搜索"), false);
  assert.equal(fallback.search.includes("教育赛道"), true);
  assert.equal(fallback.search.includes("家长争议"), true);
});

test("ops automatically exposes enabled prompts from hotspot-sources without code changes", async () => {
  const ops = await importTs("lib/ops-workbench.ts");
  const base = tempProject();
  fs.mkdirSync(path.join(base, "prompts", "公共热点", "来源注册"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "prompts", "公共热点", "来源注册", "人物言论雷达.md"),
    [
      "---",
      "id: people-voices",
      "title: 人物言论雷达",
      "enabled: true",
      "description: 抓 AI / 科技 / 教育 / 商业关键人物公开言论",
      "---",
      "今天是 {date}。人物言论。",
      "",
    ].join("\n"),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(base, "prompts", "公共热点", "来源注册", "关闭的来源.md"),
    [
      "---",
      "id: disabled-source",
      "title: 关闭的来源",
      "enabled: false",
      "---",
      "今天是 {date}。不应该出现。",
      "",
    ].join("\n"),
    "utf-8",
  );

  const prompts = ops.renderHotspotPrompts({
    base,
    date: "2026-06-30",
    accountId: "acct-xiaozhu-edu-xhs",
  });

  assert.deepEqual(
    prompts.broadPrompts.map((item) => item.title),
    ["人物言论雷达", "平台原生全网热点", "终极雷达热点"],
  );
  assert.equal(prompts.broadPrompts[0].id, "people-voices");
  assert.equal(prompts.broadPrompts[0].text.includes("2026-06-30"), true);
  assert.equal(prompts.broadPrompts[0].text.includes("人物言论"), true);
  assert.equal(prompts.broadPrompts.some((item) => item.title === "关闭的来源"), false);
});

test("hotspot-sources can register legacy broad prompt files without duplicating cards", async () => {
  const ops = await importTs("lib/ops-workbench.ts");
  const base = tempProject();
  fs.mkdirSync(path.join(base, "prompts", "公共热点", "来源注册"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "prompts", "公共热点", "来源注册", "平台原生全网热点.md"),
    [
      "---",
      "id: platform-native",
      "title: 平台原生全网热点",
      "enabled: true",
      "source_file: ../平台原生全网热点.md",
      "---",
      "这段说明不会进入复制提示词。",
      "",
    ].join("\n"),
    "utf-8",
  );

  const prompts = ops.renderHotspotPrompts({
    base,
    date: "2026-06-30",
    accountId: "acct-xiaozhu-edu-xhs",
  });

  assert.deepEqual(
    prompts.broadPrompts.map((item) => item.id),
    ["platform-native", "ultimate-radar"],
  );
  assert.equal(prompts.broadPrompts[0].text, "今天是 2026-06-30。公共池。");
  assert.equal(prompts.broadPrompts[0].text.includes("这段说明不会进入复制提示词"), false);
});

test("hotspot prompts ask LLMs to return system-ready hotspot JSON directly", () => {
  const broad = read("prompts/公共热点/平台原生全网热点.md");
  const ultimate = read("prompts/公共热点/终极雷达热点.md");
  const search = read("prompts/赛道热点/通用赛道热点搜索.md");

  for (const source of [broad, ultimate, search]) {
    assert.match(source, /"hotspot_id"/);
    assert.match(source, /"spread_emotion"/);
    assert.match(source, /"candidate_problem_dimensions"/);
    assert.doesNotMatch(source, /neutralize|中立化/);
  }
});

test("ops saves hotspot pools and auto-fills ids for copy-pasted LLM hotspot arrays", async () => {
  const ops = await importTs("lib/ops-workbench.ts");
  const base = tempProject();

  const saved = ops.saveHotspotPool({
    base,
    date: "2026-06-30",
    kind: "broad",
    text: JSON.stringify([
      {
        title: "高考查分全家 belike",
        summary: "高考出分后，考生和家长把查分瞬间拍成第一视角视频。",
        conflict_hint: "孩子的分数、家长期待和现实选择空间撞在一起。",
        problem_dimensions_hint: ["升学结果焦虑", "家庭决策权冲突"],
        est_heat_score_10: 8.8,
      },
    ]),
  });

  assert.equal(saved.count, 1);
  assert.equal(saved.relativePath, "data/hotspots/2026-06-30.json");
  assert.equal(fs.existsSync(path.join(base, saved.relativePath)), true);
  const written = JSON.parse(fs.readFileSync(path.join(base, saved.relativePath), "utf-8"));
  assert.equal(written[0].id, "hs-20260630-broad-001");
  assert.equal(written[0].hotspot_id, "hs-20260630-broad-001");
  assert.equal(written[0].date, "2026-06-30");
  assert.equal(written[0].scope, "broad");
  assert.equal(written[0].source_direction, "broad");
  assert.equal(written[0].conflict_point, "孩子的分数、家长期待和现实选择空间撞在一起。");
  assert.deepEqual(written[0].candidate_problem_dimensions, ["升学结果焦虑", "家庭决策权冲突"]);
  assert.equal(written[0].heat_score_10, 8.8);

  assert.throws(
    () =>
      ops.saveHotspotPool({
        base,
        date: "2026-06-30",
        kind: "broad",
        text: JSON.stringify([{ summary: "缺标题" }]),
      }),
    /title/,
  );
});

test("ops saves multiple pasted hotspot JSON arrays as one combined pool", async () => {
  const ops = await importTs("lib/ops-workbench.ts");
  const base = tempProject();

  const saved = ops.saveHotspotPool({
    base,
    date: "2026-06-30",
    kind: "broad",
    text: [
      JSON.stringify([
        {
          title: "平台原生热点",
          summary: "来自平台原生全网热点提示词。",
        },
      ]),
      JSON.stringify([
        {
          title: "终极雷达热点",
          summary: "来自终极雷达热点提示词。",
        },
      ]),
    ].join("\n\n"),
  });

  assert.equal(saved.count, 2);
  const written = JSON.parse(fs.readFileSync(path.join(base, saved.relativePath), "utf-8"));
  assert.deepEqual(
    written.map((item) => item.title),
    ["平台原生热点", "终极雷达热点"],
  );
  assert.deepEqual(
    written.map((item) => item.hotspot_id),
    ["hs-20260630-broad-001", "hs-20260630-broad-002"],
  );
});

test("ops splits pasted reply JSON into inbox files by hotspot_id", async () => {
  const ops = await importTs("lib/ops-workbench.ts");
  const base = tempProject();
  fs.mkdirSync(path.join(base, "data/runs/2026-06-30/acct-xiaozhu-edu-xhs/prompts"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "data/runs/2026-06-30/acct-xiaozhu-edu-xhs/prompts/match-hs-20260630-001.txt"),
    "prompt",
  );
  fs.writeFileSync(
    path.join(base, "data/runs/2026-06-30/acct-xiaozhu-edu-xhs/prompts/match-hs-20260630-002.txt"),
    "prompt",
  );

  const saved = ops.saveInboxReplies({
    base,
    date: "2026-06-30",
    accountId: "acct-xiaozhu-edu-xhs",
    stage: "match",
    text: JSON.stringify([
      {
        hotspot_id: "hs-20260630-001",
        tier: "strong_pick",
        skip_reason: "",
        why_relevant: "家长正在讨论。",
      },
      {
        hotspot_id: "hs-20260630-002",
        tier: "skip",
        skip_reason: "和账号关系弱。",
      },
    ]),
  });

  assert.deepEqual(
    saved.files.map((item) => item.relativePath),
    [
      "data/runs/2026-06-30/acct-xiaozhu-edu-xhs/_inbox/match-hs-20260630-001.json",
      "data/runs/2026-06-30/acct-xiaozhu-edu-xhs/_inbox/match-hs-20260630-002.json",
    ],
  );
  assert.equal(
    JSON.parse(
      fs.readFileSync(
        path.join(base, "data/runs/2026-06-30/acct-xiaozhu-edu-xhs/_inbox/match-hs-20260630-001.json"),
        "utf-8",
      ),
    ).tier,
    "strong_pick",
  );
});

test("ops refuses inbox replies for the wrong account or missing generated prompts", async () => {
  const ops = await importTs("lib/ops-workbench.ts");
  const base = tempProject();

  assert.throws(
    () =>
      ops.saveInboxReplies({
        base,
        date: "2026-06-30",
        accountId: "acct-xiaozhu-edu-xhs",
        stage: "generate",
        text: JSON.stringify([
          {
            hotspot_id: "hs-20260630-track-001",
            recommendation: "skip",
            bridge_paths: [],
            content: null,
          },
        ]),
      }),
    /当前账号还没有生成这些 generate 提示词/,
  );
  assert.equal(
    fs.existsSync(path.join(base, "data/runs/2026-06-30/acct-xiaozhu-edu-xhs/_inbox/generate-hs-20260630-track-001.json")),
    false,
  );
});

test("ops install helper runs ingest.py and never writes today/latest itself", async () => {
  const ops = await importTs("lib/ops-workbench.ts");
  const base = tempProject();
  const calls = [];

  const result = await ops.runIngest({
    base,
    date: "2026-06-30",
    accountId: "acct-xiaozhu-edu-xhs",
    execFile: async (cmd, args, options) => {
      calls.push({ cmd, args, cwd: options.cwd });
      return { stdout: "ingest ok", stderr: "" };
    },
  });

  assert.equal(result.ok, true);
  assert.match(result.output, /ingest ok/);
  assert.deepEqual(calls[0].args.slice(-5), [
    "scripts/ingest.py",
    "acct-xiaozhu-edu-xhs",
    "data/runs/2026-06-30/acct-xiaozhu-edu-xhs/_inbox",
    "--date",
    "2026-06-30",
  ]);
  assert.equal(fs.existsSync(path.join(base, "data", "today")), false);
});

test("ops python helpers fall back when the configured interpreter is missing", async () => {
  const ops = await importTs("lib/ops-workbench.ts");
  const base = tempProject();
  const calls = [];
  const previous = process.env.YOWOW_PYTHON;
  process.env.YOWOW_PYTHON = "missing-python-for-test";

  try {
    const result = await ops.runPreflight({
      base,
      date: "2026-06-30",
      accountId: "acct-xiaozhu-edu-xhs",
      execFile: async (cmd, args, options) => {
        calls.push({ cmd, args, cwd: options.cwd });
        if (cmd === "missing-python-for-test") {
          const error = new Error("spawn missing-python-for-test ENOENT");
          error.code = "ENOENT";
          throw error;
        }
        return { stdout: "preflight ok", stderr: "" };
      },
    });

    assert.equal(result.ok, true);
    assert.match(result.output, /preflight ok/);
    assert.equal(calls[0].cmd, "missing-python-for-test");
    assert.equal(calls.length >= 2, true);
    assert.deepEqual(calls.at(-1).args.slice(-5), [
      "scripts/status.py",
      "--date",
      "2026-06-30",
      "--preflight",
      "acct-xiaozhu-edu-xhs",
    ]);
  } finally {
    if (previous === undefined) {
      delete process.env.YOWOW_PYTHON;
    } else {
      process.env.YOWOW_PYTHON = previous;
    }
  }
});
