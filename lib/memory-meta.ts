// 账号记忆的「分区元数据」：每个区块叫什么、为什么重要（怎么影响每日推荐）、填没填。
// 纯前端展示逻辑，零方法论——「影响说明」只描述系统机制（筛选/生成/硬门用到哪个字段），不写桥梁内容。

import type { AccountMemory } from "@/lib/adaptation-types";

export type MemorySectionKey =
  | "business"
  | "audience"
  | "anxiety"
  | "product_value"
  | "proof"
  | "style"
  | "forbidden";

export type MemorySection = {
  key: MemorySectionKey;
  label: string;
  why: string;          // 这块信息如何影响每日推荐（机制说明，人话）
  filled: boolean;
  preview: string[];    // 查看态展示的内容（列表化）
  emptyHint: string;    // 未填时的提示
};

const list = (xs?: string[]): string[] => (xs ?? []).map((x) => x.trim()).filter(Boolean);

export function memorySections(m: AccountMemory): MemorySection[] {
  const anxiety = list(m.anxiety_anchors);
  const proof = list(m.proof_assets);
  const forbidden = [...list(m.extra_forbidden_terms), ...list(m.banned_topics)];
  return [
    {
      key: "business",
      label: "我卖什么",
      why: "判断热点「跟你生意有没有关系」的根基，每条推荐理由都从这里出发。",
      filled: Boolean(m.business?.trim()),
      preview: m.business ? [m.business] : [],
      emptyHint: "一句话说清你卖什么，系统才知道帮你接什么。",
    },
    {
      key: "audience",
      label: "我的目标客户",
      why: "决定内容写给谁看：同一个热点，对不同人群的讲法完全不同。",
      filled: Boolean(m.audience?.trim()),
      preview: m.audience ? [m.audience] : [],
      emptyHint: "写清谁会买，推荐会更贴你的客户。",
    },
    {
      key: "anxiety",
      label: "客户焦虑",
      why: "筛热点的核心依据：热点背后的真实问题，必须对上这里的某条焦虑才算接得住。",
      filled: anxiety.length > 0,
      preview: anxiety,
      emptyHint: "客户最怕什么、最在意什么？这是判断「自然 vs 硬蹭」的关键。",
    },
    {
      key: "product_value",
      label: "产品价值",
      why: "每条内容的落点：从热点讲到这里才算闭环，接不到这里的热点会被判「不建议蹭」。",
      filled: Boolean(m.product_value?.trim()),
      preview: m.product_value ? [m.product_value] : [],
      emptyHint: "你的东西最大的好是什么？内容最终都要落到这里。",
    },
    {
      key: "proof",
      label: "信任证据",
      why: "生成文案时用来支撑说法的素材：实拍、检测、案例……有证据的内容更可信。",
      filled: proof.length > 0,
      preview: proof,
      emptyHint: "你能拿出什么让人信你？写进来，文案会更有底气。",
    },
    {
      key: "style",
      label: "内容风格 / 口吻",
      why: "决定成稿的语气：直给还是温和、像老板还是像专家。",
      filled: Boolean(m.content_style?.trim()),
      preview: m.content_style ? [m.content_style] : [],
      emptyHint: "不填就按人设默认口吻来。",
    },
    {
      key: "forbidden",
      label: "内容禁区",
      why: "出口硬门：这些词和话题出现即拦下，绝不会出现在你的文案里。",
      filled: forbidden.length > 0,
      preview: forbidden,
      emptyHint: "有绝不想出现的词或话题就写进来，系统会替你把门。",
    },
  ];
}

export function memoryCompleteness(m: AccountMemory): {
  filled: number;
  total: number;
  percent: number;
  missing: string[];
} {
  const sections = memorySections(m);
  // style 和 forbidden 是可选项，不计入完整度分母（但展示）
  const core = sections.filter((s) => s.key !== "style" && s.key !== "forbidden");
  const filled = core.filter((s) => s.filled).length;
  return {
    filled,
    total: core.length,
    percent: Math.round((filled / core.length) * 100),
    missing: core.filter((s) => !s.filled).map((s) => s.label),
  };
}
