const DISPLAY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/须部假性毛囊炎\s*\/\s*内生发与红肿/g, "剃须后红肿、内生发和小疙瘩"],
  [/经皮水分流失\s*TEWL\s*与角质层屏障/g, "皮肤锁水和角质层屏障"],
  [/亚临床慢性炎症导致的区域性色素沉着与提前衰老/g, "反复小刺激导致局部留印和显老"],
  [/皮肤微生态\s*Microbiome\s*与机会性感染风险/g, "皮肤菌群平衡和易出问题的皮肤状态"],
  [/须部假性毛囊炎/g, "剃须后红肿小疙瘩"],
  [/经皮水分流失/g, "皮肤水分流失"],
  [/亚临床慢性炎症/g, "不易察觉的反复发炎"],
  [/区域性色素沉着/g, "局部暗沉留印"],
  [/机会性感染风险/g, "容易出问题的皮肤状态"],
  [/\bTEWL\b/gi, "皮肤水分流失"],
  [/\bMicrobiome\b/gi, "皮肤菌群"],
  [/\bPFB\b/gi, "剃须后红肿小疙瘩"],
  [/far transfer/gi, "跨场景连接"],
  [/远迁移/g, "跨场景连接"],
  [/\bOOD\b/g, "陌生场景"],
  [/relevance/gi, "匹配度"],
  [/naturalness/gi, "顺不顺"],
];

export function displayText(value: string | null | undefined): string {
  if (!value) return "";
  const replaced = DISPLAY_REPLACEMENTS.reduce((text, [pattern, replacement]) => {
    return text.replace(pattern, replacement);
  }, value);
  return replaced.replace(/(皮肤水分流失)\s+\1/g, "$1").replace(/(皮肤菌群)\s+\1/g, "$1");
}

export function displayList(values: string[] | null | undefined): string[] {
  if (!values?.length) return [];
  return values.map(displayText).filter(Boolean);
}
