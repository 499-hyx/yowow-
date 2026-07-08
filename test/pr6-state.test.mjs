import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  memoryEditMode,
  primaryDashboardAction,
  sparkInputMode,
  sparkAdminCopy,
  staleDataNotice,
} from "../lib/pr6-state.mjs";

test("online memory editing is replaced with a local file handoff message", () => {
  const mode = memoryEditMode({ tursoEnabled: true });

  assert.equal(mode.editable, false);
  assert.equal(
    mode.message,
    "线上当前只能查看账号定位。要修改，请编辑本地 data/accounts/<account_id>.json；下次跑批生效。",
  );
  assert.doesNotMatch(mode.message, /管理员|Turso|PATCH|只读文件系统/);
});

test("local memory editing remains writable", () => {
  assert.equal(memoryEditMode({ tursoEnabled: false }).editable, true);
});

test("online spark entry uses local file handoff instead of submission", () => {
  const mode = sparkInputMode({ tursoEnabled: true });

  assert.equal(mode.submittable, false);
  assert.equal(sparkAdminCopy("小朱教育号", "高考志愿家长焦虑"), "给【小朱教育号】新增一条本地灵感：高考志愿家长焦虑");
  assert.match(mode.description, /保存为本地灵感记录/);
  assert.doesNotMatch(mode.description, /data\/spark-inbox|Turso|PATCH|只读文件系统/);
});

test("local spark entry remains submittable", () => {
  assert.equal(sparkInputMode({ tursoEnabled: false }).submittable, true);
});

test("dashboard primary action opens the first account when today data exists", () => {
  const action = primaryDashboardAction({
    accounts: [{ account_id: "acct-a" }],
    displayedDate: "2026-06-13",
    today: "2026-06-13",
  });

  assert.deepEqual(action, {
    kind: "link",
    label: "打开今天第一个账号",
    href: "/account/acct-a?date=2026-06-13",
  });
});

test("dashboard primary action copies today's todo when only old data exists", () => {
  const action = primaryDashboardAction({
    accounts: [{ account_id: "acct-a" }],
    displayedDate: "2026-06-12",
    today: "2026-06-13",
  });

  assert.equal(action.kind, "copy");
  assert.equal(action.label, "复制今日待办话术");
  assert.match(action.text, /今天发什么/);
});

test("dashboard primary action falls back to the account list without accounts", () => {
  const action = primaryDashboardAction({
    accounts: [],
    displayedDate: null,
    today: "2026-06-13",
  });

  assert.deepEqual(action, {
    kind: "link",
    label: "查看账号列表",
    href: "/accounts",
  });
});

test("dashboard shows a stale-data notice when the displayed date is not today", () => {
  assert.equal(
    staleDataNotice({ displayedDate: "2026-06-12", today: "2026-06-13" }),
    "今天（2026-06-13）还没有跑批，下面展示的是最近一次结果（2026-06-12）。",
  );
});

test("dashboard does not show a stale-data notice for today's data", () => {
  assert.equal(staleDataNotice({ displayedDate: "2026-06-13", today: "2026-06-13" }), null);
});

test("admin debug pages do not expose backend wording or bypass display text", () => {
  const files = [
    "app/account/[account_id]/page.tsx",
    "app/card/[account_id]/[date]/[hotspot_id]/page.tsx",
    "app/hotspots/[hotspot_id]/page.tsx",
  ];
  const joined = files.map((file) => fs.readFileSync(file, "utf-8")).join("\n");

  assert.doesNotMatch(joined, /打开后台视图|后台视图|后台说明/);
  assert.doesNotMatch(joined, /\(value: string\) => value/);
  assert.doesNotMatch(joined, /ownerView \? displayText\([^)]*\) : [^;\n)]+/);
});
