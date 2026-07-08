import assert from "node:assert/strict";
import fs from "node:fs";
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

test("README and AGENTS describe the single-maintainer adaptation system", () => {
  const readme = read("README.md");
  const agents = read("AGENTS.md");

  for (const phrase of [
    "多赛道热点适配系统",
    "热点是公共原料",
    "牵强则跳过",
    "新增赛道主要通过配置完成",
    "config/tracks",
  ]) {
    assert.match(readme, new RegExp(phrase));
  }

  for (const phrase of [
    "这个项目是什么",
    "核心目录",
    "配置",
    "引擎",
    "不要把内部分析术语展示给用户",
    "改完必须跑",
  ]) {
    assert.match(agents, new RegExp(phrase));
  }

  assert.doesNotMatch(readme, /config\/bridge-directions/);
});

test("config contracts normalize existing tracks, accounts, and platforms", async () => {
  const contracts = await importTs("lib/config-contracts.ts");
  const track = JSON.parse(read("config/tracks/razor-personalcare.json"));
  const account = JSON.parse(read("data/accounts/acct-razor-douyin-boss.json"));
  const platform = JSON.parse(read("config/platforms/douyin.json"));

  const normalizedTrack = contracts.normalizeTrackConfig(track);
  const normalizedAccount = contracts.normalizeAccountConfig(account);
  const normalizedPlatform = contracts.normalizePlatformConfig(platform);

  assert.equal(normalizedTrack.track_id, "razor-personalcare");
  assert.ok(normalizedTrack.business_goals.length > 0);
  assert.ok(normalizedTrack.natural_connection_patterns.length > 0);
  assert.ok(normalizedTrack.forbidden_terms.includes("远迁移"));
  assert.ok(normalizedTrack.skip_rules.length > 0);

  assert.equal(normalizedAccount.account_id, "acct-razor-douyin-boss");
  assert.equal(normalizedAccount.track_id, "razor-personalcare");
  assert.ok(normalizedAccount.platforms.includes("douyin"));
  assert.ok(normalizedAccount.business_offers.length > 0);

  assert.equal(normalizedPlatform.platform_id, "douyin");
  assert.ok(normalizedPlatform.content_style);
  assert.ok(normalizedPlatform.forbidden_patterns.length > 0);
  assert.ok(normalizedPlatform.recommended_structure);
});

test("skipGate makes conservative skip decisions without generating drafts", async () => {
  const gate = await importTs("lib/skip-gate.ts");
  const base = {
    recommendation: "strong_pick",
    bridge_paths: [
      {
        path_id: "p1",
        phenomenon: "大家开始重新看产品真实价值。",
        real_problem: "用户怕为品牌溢价买单。",
        track_relation: "这能接到日常剃须工具的真实体验。",
        product_value_support: "强调稳定、顺手和效率。",
        platform_expression: "抖音短句直接讲判断。",
      },
      {
        path_id: "p2",
        phenomenon: "用户开始追问选择标准。",
        real_problem: "害怕踩雷。",
        track_relation: "剃须刀也需要可执行标准。",
        product_value_support: "给出省时间的判断法。",
        platform_expression: "用三点清单表达。",
      },
      {
        path_id: "p3",
        phenomenon: "大牌光环被重新审视。",
        real_problem: "名气不等于体验。",
        track_relation: "个护工具也要回到每日效果。",
        product_value_support: "产品价值落到体面感。",
        platform_expression: "老板口吻给结论。",
      },
    ],
    content: {
      topic: "大牌光环退了以后，个护该看什么",
      title: "买个护别只看牌子",
      body_or_script: "真正救你的，是每天出门前顺手、稳定、不耽误事。",
    },
  };

  assert.equal(gate.evaluateSkipGate(base, { platformId: "douyin" }).skip, false);
  assert.equal(gate.evaluateSkipGate({ ...base, bridge_paths: [] }).skip, true);
  assert.equal(gate.evaluateSkipGate({ ...base, content: null }).skip, true);
  assert.equal(
    gate.evaluateSkipGate(base, { trackForbiddenTerms: ["稳定"] }).skip,
    true,
  );
  assert.equal(
    gate.evaluateSkipGate(base, { accountForbiddenTerms: ["不耽误事"] }).skip,
    true,
  );
  assert.equal(
    gate.evaluateSkipGate({ ...base, content: { ...base.content, title: "far transfer" } }).skip,
    true,
  );
  assert.equal(
    gate.evaluateSkipGate(base, { platformId: "wechat-official", supportedPlatformIds: ["douyin"] }).skip,
    true,
  );
});

