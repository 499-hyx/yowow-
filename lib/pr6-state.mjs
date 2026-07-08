// pr6-state.mjs — 本地/线上模式下的页面动作和提示文案。
//
// 线上 Turso 模式只允许只读和收反馈；本地模式允许复制/保存给维护者处理。
// 这里不读写 data/today，也不参与跑批。

export const ONLINE_MEMORY_MESSAGE =
  "线上当前只能查看账号定位。要修改，请编辑本地 data/accounts/<account_id>.json；下次跑批生效。";

export const ONLINE_SPARK_DESCRIPTION =
  "线上当前不能直接提交灵感。请把下面的话保存为本地灵感记录；下一次跑批前放入热点池或账号上下文。";

export function memoryEditMode({ tursoEnabled }) {
  return tursoEnabled
    ? { editable: false, message: ONLINE_MEMORY_MESSAGE }
    : { editable: true, message: "" };
}

export function sparkInputMode({ tursoEnabled }) {
  return tursoEnabled
    ? { submittable: false, description: ONLINE_SPARK_DESCRIPTION }
    : { submittable: true, description: "临时想到的选题会收在这里，处理发生在每日跑批时。" };
}

export function sparkAdminCopy(accountName, text) {
  return `给【${accountName || "账号名"}】新增一条本地灵感：${text || "……"}`;
}

export function todayInShanghai(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function primaryDashboardAction({ accounts, displayedDate, today }) {
  if (!accounts.length) {
    return { kind: "link", label: "查看账号列表", href: "/accounts" };
  }
  if (displayedDate !== today) {
    return {
      kind: "copy",
      label: "复制今日待办话术",
      text: "所有账号今天发什么",
    };
  }
  return {
    kind: "link",
    label: "打开今天第一个账号",
    href: `/account/${accounts[0].account_id}?date=${displayedDate}`,
  };
}

export function staleDataNotice({ displayedDate, today }) {
  if (!displayedDate || displayedDate === today) return null;
  return `今天（${today}）还没有跑批，下面展示的是最近一次结果（${displayedDate}）。`;
}
