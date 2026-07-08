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
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
    fileName: file,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const accounts = {
  razor: {
    account_id: "acct-razor-douyin-boss",
    track_id: "razor-personalcare",
    platform_id: "douyin",
    forbidden: ["智商税"],
  },
  education: {
    account_id: "acct-xiaozhu-edu-xhs",
    track_id: "education-yowow",
    platform_id: "xiaohongshu",
    forbidden: ["鸡娃"],
  },
};

function pathFor(hotspot, account, overrides = {}) {
  return {
    path_id: overrides.path_id ?? "p1",
    phenomenon: hotspot.title,
    real_problem: overrides.real_problem ?? hotspot.problem,
    track_relation: overrides.track_relation ?? `自然接到 ${account.track_id}`,
    product_value_support: overrides.product_value_support ?? "能支撑账号的产品价值。",
    platform_expression: overrides.platform_expression ?? `适合在 ${account.platform_id} 用人话表达。`,
  };
}

function outputFor(hotspot, account, recommendation, overrides = {}) {
  const skip = recommendation === "skip";
  return {
    hotspot_id: hotspot.hotspot_id,
    track_id: account.track_id,
    platform_id: account.platform_id,
    positioning_id: "boss",
    recommendation,
    forced_flag: skip,
    skip_reason: skip ? (overrides.skip_reason ?? "连接牵强，已跳过。") : null,
    bridge_paths: skip
      ? []
      : [
          pathFor(hotspot, account, { path_id: "p1", ...(overrides.path ?? {}) }),
          pathFor(hotspot, account, { path_id: "p2" }),
          pathFor(hotspot, account, { path_id: "p3" }),
        ],
    chosen_path_id: skip ? null : "p1",
    content: skip
      ? null
      : {
          topic: overrides.topic ?? `${hotspot.title} 的账号角度`,
          title: overrides.title ?? `${hotspot.title}，可以这样讲`,
          body_or_script: overrides.body ?? "这条可以从真实问题切入，再落到产品价值。",
        },
    external_terms_check: !overrides.internalLeak,
  };
}

const hotspots = [
  { hotspot_id: "hs-high-heat-bad-fit", title: "明星红毯同框刷屏", heat: 9.8, problem: "只有娱乐情绪，没有业务问题。" },
  { hotspot_id: "hs-low-heat-good-fit", title: "剃须后红肿讨论升温", heat: 4.2, problem: "用户怕日常剃须后不舒服。" },
  { hotspot_id: "hs-forced-related", title: "老板穿搭争议", heat: 8.1, problem: "只能靠情绪硬蹭到产品。" },
  { hotspot_id: "hs-edu-ai", title: "AI 志愿填报让家长焦虑", heat: 7.5, problem: "家长怕孩子把判断交给工具。" },
  { hotspot_id: "hs-factory-digital", title: "工厂数字化排产系统出圈", heat: 5.8, problem: "老板关心流程效率和确定性。" },
  { hotspot_id: "hs-xhs-fit", title: "家长晒暑假计划清单", heat: 6.1, problem: "家长想要可收藏的陪伴方法。" },
  { hotspot_id: "hs-wechat-long", title: "行业白皮书长文热传", heat: 6.9, problem: "需要长文解释，不适合短平快。" },
  { hotspot_id: "hs-risk", title: "未成年人极端事件", heat: 9.5, problem: "有风险，容易消费焦虑。" },
  { hotspot_id: "hs-bridge-required", title: "配料表第一位讨论", heat: 5.5, problem: "用户想看懂真实选择标准。" },
  { hotspot_id: "hs-internal-leak", title: "陌生问题训练", heat: 5.1, problem: "模型可能泄露内部术语。" },
];

const expectedByHotspot = {
  "hs-high-heat-bad-fit": { razor: "skip", education: "skip" },
  "hs-low-heat-good-fit": { razor: "strong_pick", education: "skip" },
  "hs-forced-related": { razor: "skip", education: "skip" },
  "hs-edu-ai": { razor: "skip", education: "strong_pick" },
  "hs-factory-digital": { razor: "maybe", education: "skip" },
  "hs-xhs-fit": { razor: "skip", education: "strong_pick" },
  "hs-wechat-long": { razor: "skip", education: "skip" },
  "hs-risk": { razor: "skip", education: "skip" },
  "hs-bridge-required": { razor: "strong_pick", education: "maybe" },
  "hs-internal-leak": { razor: "skip", education: "skip" },
};

test("golden adaptation matrix keeps core recommendation judgments stable", async () => {
  const { evaluateSkipGate } = await importTs("lib/skip-gate.ts");
  let checked = 0;

  for (const hotspot of hotspots) {
    for (const [accountKey, account] of Object.entries(accounts)) {
      const recommendation = expectedByHotspot[hotspot.hotspot_id][accountKey];
      const name = `${hotspot.hotspot_id} × ${account.account_id}`;
    const overrides =
      hotspot.hotspot_id === "hs-forced-related"
        ? { path: { track_relation: "需要情绪硬蹭到账号。" } }
        : hotspot.hotspot_id === "hs-internal-leak"
          ? { title: "far transfer 训练", internalLeak: true }
          : {};
      const outputRecommendation = ["hs-forced-related", "hs-internal-leak"].includes(hotspot.hotspot_id)
        ? "maybe"
        : recommendation === "skip"
          ? "skip"
          : recommendation;
      const output = outputFor(hotspot, account, outputRecommendation, overrides);
    const gate = evaluateSkipGate(output, {
      accountForbiddenTerms: account.forbidden,
      platformId: account.platform_id,
      supportedPlatformIds: hotspot.hotspot_id === "hs-wechat-long" ? ["wechat-official"] : [account.platform_id],
    });

    const finalRecommendation = gate.skip ? "skip" : output.recommendation;
    assert.equal(finalRecommendation, recommendation, name);

    if (finalRecommendation !== "skip") {
      assert.ok(output.bridge_paths.length >= 3, `${name}: bridge_paths missing`);
      for (const bridgePath of output.bridge_paths) {
        assert.ok(bridgePath.phenomenon);
        assert.ok(bridgePath.real_problem);
        assert.ok(bridgePath.track_relation);
        assert.ok(bridgePath.product_value_support);
        assert.ok(bridgePath.platform_expression);
      }
      assert.ok(output.content?.title);
      assert.ok(output.content?.body_or_script);
    }
      checked += 1;
    }
  }
  assert.equal(checked, 20, "golden matrix must cover 10 hotspots × 2 accounts");
});
