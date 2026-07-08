import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureTrackPrompts } from "../scripts/ensure-track-prompts.mjs";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

test("ensureTrackPrompts creates missing prompt folders without overwriting hand-written prompts", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "track-prompts-"));
  const track = {
    track_id: "demo-track",
    track_name: "演示赛道",
    audience: "演示用户",
    product_value: "演示价值",
    daily_search_question: "过去一个月有哪些演示热点？",
    bridge: {
      external_vocab: ["人话表达"],
      forbidden_terms: ["不能说"],
      search_directions: ["方向一", "方向二"],
    },
  };
  writeJson(path.join(base, "config", "tracks", "demo-track.json"), track);

  const created = ensureTrackPrompts({ base, log: false }).map((file) =>
    path.relative(base, file).split(path.sep).join("/"),
  );

  assert.deepEqual(created.sort(), [
    "prompts/分析提示词/demo-track",
    "prompts/赛道热点/demo-track",
  ]);

  const searchFile = path.join(base, "prompts", "赛道热点", "demo-track", "热点搜索.md");
  const analysisDir = path.join(base, "prompts", "分析提示词", "demo-track");
  assert.equal(fs.existsSync(path.dirname(searchFile)), true);
  assert.equal(fs.existsSync(analysisDir), true);
  assert.equal(fs.existsSync(searchFile), false);

  fs.mkdirSync(path.dirname(searchFile), { recursive: true });
  fs.writeFileSync(searchFile, "人工写好的搜索提示词", "utf-8");
  const secondRun = ensureTrackPrompts({ base, log: false });
  assert.deepEqual(secondRun, []);
  assert.equal(fs.readFileSync(searchFile, "utf-8"), "人工写好的搜索提示词");
});

test("ensureTrackPrompts skips temporary test track ids", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "track-prompts-fixture-"));
  writeJson(path.join(base, "config", "tracks", "mvp-internal-paused-track.json"), {
    track_id: "mvp-internal-paused-track",
    track_name: "Temporary Test Track",
  });

  const created = ensureTrackPrompts({ base, log: false });

  assert.deepEqual(created, []);
  assert.equal(
    fs.existsSync(path.join(base, "prompts", "赛道热点", "mvp-internal-paused-track", "热点搜索.md")),
    false,
  );
});
