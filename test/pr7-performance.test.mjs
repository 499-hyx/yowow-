import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(path, "utf-8");
}

test("data source exposes read-only batch helpers", () => {
  const source = read("lib/data-source.ts");

  assert.match(source, /export const getDocs/);
  assert.match(source, /export const listDocsByKeyLike/);
  assert.match(source, /WHERE kind = \? AND key IN/);
  assert.match(source, /WHERE kind = \? AND key LIKE \?/);
});

test("dashboard snapshot uses batched today and track hotspot reads", () => {
  const source = read("lib/dashboard-data.ts");

  assert.match(source, /getDocs<.*TodayResponseWithMeta/s);
  assert.match(source, /listDocsByKeyLike<.*HotspotRecord/s);
  assert.doesNotMatch(source, /for \(const key of trackKeys\)[\s\S]*getDoc<HotspotRecord\[]>/);
  assert.doesNotMatch(source, /accounts\.map\(async \(account\)[\s\S]*loadTodayForDate/);
});

test("account page parses selected tab before loading workbench and passes include flags", () => {
  const source = read("app/account/[account_id]/page.tsx");
  const selectedTabIndex = source.indexOf("const selectedTab = normalizeTab");
  const workbenchIndex = source.indexOf("await loadAccountWorkbench(");

  assert.ok(selectedTabIndex > -1);
  assert.ok(workbenchIndex > -1);
  assert.ok(selectedTabIndex < workbenchIndex);
  assert.match(source, /includeToday: selectedTab === "today"/);
  assert.match(source, /includeHotspots: selectedTab === "today"/);
  assert.match(source, /includeHistory: selectedTab === "history"/);
  assert.match(source, /includeTrackConfig: selectedTab === "memory"/);
});

test("perf log hook is gated by PR7_PERF_LOG", () => {
  const source = read("lib/perf-log.ts");

  assert.match(source, /PR7_PERF_LOG/);
  assert.match(source, /withPerfSpan/);
  assert.match(source, /recordTursoQuery/);
});
