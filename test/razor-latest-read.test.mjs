import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf-8"));
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf-8");
}

test("razor latest is a 2026-06-29 internal MVP result", () => {
  const latest = readJson("data/today/acct-razor-douyin-boss/latest.json");

  assert.equal(latest.date, "2026-06-29");
  assert.equal(latest.needs_human_review, true);
  assert.equal(latest.formal_approval, false);
  assert.equal(latest.mvp_internal_only, true);
  assert.equal(latest.review_status?.track_status, "paused");
  assert.equal(latest.board.picks.length, 2);
  assert.equal(latest.board.skipped.length, 2);
});

test("today API and account page preserve internal review status", () => {
  const route = read("app/api/today/route.ts");
  const accountPage = read("app/account/[account_id]/page.tsx");

  assert.match(route, /return Response\.json\(\{ \.\.\.response, account, notice \}\)/);
  assert.match(accountPage, /response\?\.needs_human_review/);
  assert.match(accountPage, /本地工程内测产物/);
});
