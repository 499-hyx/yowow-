import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  QUESTION_SECTIONS,
  buildAccountJson,
  buildTrackDraftJson,
  parseLines,
} from "../lib/onboarding-questionnaire.mjs";

test("questionnaire asks enough questions to form track memory", () => {
  const ids = QUESTION_SECTIONS.flatMap((section) => section.questions.map((question) => question.id));

  for (const required of [
    "track_name",
    "audience",
    "product_value",
    "anxiety_anchors",
    "proof_assets",
    "search_directions",
    "external_vocab",
    "forbidden_terms",
    "banned_topics",
  ]) {
    assert.ok(ids.includes(required), `missing question: ${required}`);
  }
});

test("questionnaire answers build runnable track and account JSON", () => {
  const answers = {
    track_name: "男士个护 · 剃须刀",
    account_name: "剃须刀老板号",
    platform_id: "douyin",
    positioning_id: "boss",
    business: "男士剃须刀及个护产品",
    audience: "注重形象和效率的男性",
    product_value: "出门前几分钟拿到确定的体面感",
    anxiety_anchors: "胡茬显邋遢\n重要场合状态差",
    proof_assets: "工厂实拍\n用户测评",
    commercial_goal: "直接带货\n建立信任",
    content_style: "老板口吻，直接，不绕弯",
    search_directions: "夏季清爽\n出门效率\n男性体面感",
    external_vocab: "男性体面感\n日常效率",
    forbidden_terms: "飞科\n吉列",
    banned_topics: "医美\n极限低价对比",
  };

  const track = buildTrackDraftJson(answers);
  const account = buildAccountJson(answers);

  assert.equal(track.status, "active");
  assert.equal(track.track_id, "mens-grooming-razor");
  assert.ok(track.daily_search_question.includes("夏季清爽"));
  assert.deepEqual(track.track_memory.anxiety_anchors, ["胡茬显邋遢", "重要场合状态差"]);
  assert.deepEqual(track.bridge.search_directions, ["夏季清爽", "出门效率", "男性体面感"]);
  assert.ok(track.decision_layer.name);
  assert.ok(track.analysis_layer.name);
  assert.deepEqual(track.output_channels, [account.account_id]);

  assert.equal(account.track_id, track.track_id);
  assert.equal(Object.hasOwn(account, "status"), false);
  assert.equal(account.memory.product_value, answers.product_value);
  assert.deepEqual(account.memory.extra_forbidden_terms, ["飞科", "吉列"]);
});

test("parseLines trims empty and comma-separated input", () => {
  assert.deepEqual(parseLines("A, B\n\nC，D"), ["A", "B", "C", "D"]);
});

test("onboarding page presents questionnaire instead of static JSON instructions", () => {
  const page = fs.readFileSync("app/onboarding/page.tsx", "utf-8");

  assert.match(page, /用问卷生成赛道记忆和账号记忆/);
  assert.match(page, /buildTrackDraftJson/);
  assert.match(page, /buildAccountJson/);
  assert.doesNotMatch(page, /新增账号走本地 JSON/);
});
