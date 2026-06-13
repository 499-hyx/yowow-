import assert from "node:assert/strict";
import test from "node:test";

import {
  memoryEditMode,
  sparkInputMode,
  sparkAdminCopy,
} from "../lib/pr6-state.mjs";

test("online memory editing is replaced with an admin handoff message", () => {
  const mode = memoryEditMode({ tursoEnabled: true });

  assert.equal(mode.editable, false);
  assert.equal(
    mode.message,
    "线上当前只能查看账号定位。要修改，请把修改内容发给管理员，由管理员同步到系统，下次跑批生效。",
  );
  assert.doesNotMatch(mode.message, /本地编辑|Turso|PATCH|只读文件系统/);
});

test("local memory editing remains writable", () => {
  assert.equal(memoryEditMode({ tursoEnabled: false }).editable, true);
});

test("online spark entry uses copy-to-admin handoff instead of submission", () => {
  const mode = sparkInputMode({ tursoEnabled: true });

  assert.equal(mode.submittable, false);
  assert.equal(sparkAdminCopy("小朱教育号", "高考志愿家长焦虑"), "给【小朱教育号】新增一条灵感：高考志愿家长焦虑");
  assert.match(mode.description, /管理员处理后，才会进入下一次热点筛选/);
  assert.doesNotMatch(mode.description, /data\/spark-inbox|Turso|PATCH|只读文件系统/);
});

test("local spark entry remains submittable", () => {
  assert.equal(sparkInputMode({ tursoEnabled: false }).submittable, true);
});
