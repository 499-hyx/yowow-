export const ONLINE_MEMORY_MESSAGE =
  "线上当前只能查看账号定位。要修改，请把修改内容发给管理员，由管理员同步到系统，下次跑批生效。";

export const ONLINE_SPARK_DESCRIPTION =
  "线上当前不能直接提交灵感。请复制下面的话发给管理员或 agent；灵感需要管理员处理后，才会进入下一次热点筛选。";

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
  return `给【${accountName || "账号名"}】新增一条灵感：${text || "……"}`;
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
