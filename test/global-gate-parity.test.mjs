// test/global-gate-parity.test.mjs
//
// 守住「禁词/内部术语单一来源」：config/global-gate.json 是唯一真理。
// Python 活路径（make-prompt.py / ingest.py）直接读它；本测试守住 TS 三处副本
// （lib/adaptation-types.ts、lib/skip-gate.ts、lib/display-text.ts）与它一致——
// 任何一处漂移（加词漏同步、改词不一致）都会让本测试失败。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf-8");

async function importTs(file) {
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
    fileName: file,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const gate = JSON.parse(read("config/global-gate.json"));
const internal = gate.internal_or_score;
const forced = gate.forced_connection_hints;

test("global-gate.json 自身结构正确", () => {
  assert.ok(Array.isArray(internal) && internal.length > 0, "internal_or_score 必须是非空数组");
  assert.ok(Array.isArray(forced) && forced.length > 0, "forced_connection_hints 必须是非空数组");
});

test("adaptation-types.ts 的 INTERNAL_OR_SCORE 与单一来源逐字一致", async () => {
  const mod = await importTs("lib/adaptation-types.ts");
  assert.deepEqual(
    [...mod.INTERNAL_OR_SCORE].sort(),
    [...internal].sort(),
    "lib/adaptation-types.ts 的内部术语清单与 config/global-gate.json 漂移了，请同步",
  );
});

test("skip-gate.ts 识别单一来源里的每个内部术语 + 每个 forced hint", async () => {
  const { scanInternalTerms, evaluateSkipGate } = await importTs("lib/skip-gate.ts");
  for (const term of internal) {
    assert.ok(
      scanInternalTerms(term).length > 0,
      `skip-gate.ts 不识别内部术语「${term}」——它与 config/global-gate.json 漂移了`,
    );
  }
  // forced hint：放进一条本来合格的成品里，gate 必须翻成 skip
  const okPaths = Array.from({ length: 3 }, (_, i) => ({
    path_id: `p${i + 1}`,
    phenomenon: "大家在重新看真实价值。",
    real_problem: "怕为名气买单。",
    track_relation: "接到日常真实体验。",
    product_value_support: "强调稳定顺手。",
    platform_expression: "短句直接讲判断。",
  }));
  for (const hint of forced) {
    const out = {
      recommendation: "strong_pick",
      bridge_paths: okPaths.map((p) => ({ ...p, track_relation: `这条需要${hint}才接得上。` })),
      content: { topic: "t", title: "标题", body_or_script: "正文" },
    };
    assert.equal(
      evaluateSkipGate(out, {}).skip,
      true,
      `skip-gate.ts 没把 forced hint「${hint}」判成 skip——它与 config/global-gate.json 漂移了`,
    );
  }
});

// display-text.ts 是【次级·化妆层】（把漏网术语在展示时改写成人话），
// 主闸门是 ingest.py（命中即整条降级 skip）。因此这里只守「最易在正文里裸奔的
// 核心方法论术语」必须有改写覆盖，不要求穷尽全部 9 个词。
// 已知缺口（留作后续相位补全或同样由 global-gate 驱动）：
//   in-distribution / 范式转移 / 相关度分 / 自然度分 目前未在 display-text 改写。
test("display-text.ts 覆盖最易裸奔的核心方法论术语", () => {
  const src = read("lib/display-text.ts");
  for (const term of ["far transfer", "远迁移", "OOD"]) {
    assert.ok(
      src.includes(term),
      `display-text.ts 丢了核心术语「${term}」的改写覆盖`,
    );
  }
});

test("make-prompt.py 已接到单一来源（不再硬编码为唯一真理）", () => {
  const src = read("scripts/make-prompt.py");
  assert.ok(
    src.includes("global-gate.json"),
    "scripts/make-prompt.py 没有从 config/global-gate.json 读取内部术语清单",
  );
});

test("ingest.py 线上闸门已接 forced-hints 单一来源", () => {
  const src = read("scripts/ingest.py");
  assert.ok(
    src.includes("forced_connection_hints") && src.includes("FORCED_CONNECTION_HINTS"),
    "ingest.py 未从 config/global-gate.json 读取 forced_connection_hints",
  );
});
