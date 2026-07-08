export const PLATFORM_OPTIONS = [
  { id: "xiaohongshu", name: "小红书" },
  { id: "douyin", name: "抖音" },
  { id: "shipinhao", name: "视频号" },
  { id: "bilibili", name: "B站" },
  { id: "youtube", name: "YouTube" },
];

export const POSITIONING_OPTIONS = [
  { id: "expert", name: "专家型" },
  { id: "boss", name: "老板型" },
  { id: "factory-source", name: "工厂源头型" },
];

export const QUESTION_SECTIONS = [
  {
    title: "赛道记忆",
    description: "这些答案决定系统以后怎么判断一个热点能不能接。",
    questions: [
      { id: "track_name", label: "这个赛道一句话叫什么？", type: "text", placeholder: "例：男士个护 · 剃须刀" },
      { id: "audience", label: "这个赛道主要帮谁解决问题？", type: "textarea", placeholder: "例：20-45 岁注重形象与效率的男性" },
      { id: "product_value", label: "产品或服务最大的好处是什么？", type: "textarea", placeholder: "例：出门前几分钟拿到确定的体面感" },
      { id: "anxiety_anchors", label: "客户最在意或最焦虑什么？", type: "textarea", placeholder: "每行一个。例：胡茬显邋遢" },
      { id: "proof_assets", label: "有哪些真实证据能让人相信？", type: "textarea", placeholder: "每行一个。例：工厂实拍、用户测评、资质证书" },
      { id: "search_directions", label: "这个赛道适合追哪些热点方向？", type: "textarea", placeholder: "每行一个。例：夏季清爽、出门效率、男性体面感" },
      { id: "external_vocab", label: "对外可以反复使用哪些人话词？", type: "textarea", placeholder: "每行一个。例：日常效率、男性体面感" },
      { id: "forbidden_terms", label: "哪些词绝对不要出现在成品里？", type: "textarea", placeholder: "每行一个。例：竞品名、容易踩雷的说法" },
      { id: "banned_topics", label: "哪些话题绝对不碰？", type: "textarea", placeholder: "每行一个。例：医美、极限低价对比" },
    ],
  },
  {
    title: "账号记忆",
    description: "这些答案决定同一赛道下，这个账号怎么写、怎么说。",
    questions: [
      { id: "account_name", label: "账号展示名是什么？", type: "text", placeholder: "例：剃须刀老板号" },
      { id: "platform_id", label: "主要发布平台", type: "select", options: PLATFORM_OPTIONS },
      { id: "positioning_id", label: "出镜或表达的人设", type: "select", options: POSITIONING_OPTIONS },
      { id: "business", label: "这个账号具体卖什么？", type: "textarea", placeholder: "例：男士剃须刀及个护产品" },
      { id: "commercial_goal", label: "发内容最想达成什么？", type: "textarea", placeholder: "每行一个。例：直接带货、建立信任、引流获客" },
      { id: "content_style", label: "这个账号说话应该是什么口吻？", type: "textarea", placeholder: "例：老板口吻，直接，不绕弯" },
    ],
  },
];

const PLATFORM_NAMES = Object.fromEntries(PLATFORM_OPTIONS.map((item) => [item.id, item.name]));
const POSITIONING_NAMES = Object.fromEntries(POSITIONING_OPTIONS.map((item) => [item.id, item.name]));

const PINYIN_WORDS = new Map([
  ["男士", "mens"],
  ["男性", "mens"],
  ["个护", "grooming"],
  ["剃须刀", "razor"],
  ["教育", "education"],
  ["儿童", "kids"],
  ["宠物", "pet"],
  ["食品", "food"],
  ["健身", "fitness"],
  ["教练", "coaching"],
  ["工厂", "factory"],
  ["源头", "source"],
]);

export function parseLines(value) {
  return String(value || "")
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function slugify(value, fallback = "local-track") {
  let text = String(value || "").toLowerCase();
  for (const [cn, en] of PINYIN_WORDS.entries()) {
    text = text.replaceAll(cn, ` ${en} `);
  }
  text = text
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return text || fallback;
}

function shortTrackId(answers) {
  return answers.track_id || slugify(answers.track_name, "local-track");
}

function accountId(answers) {
  const base = slugify(answers.account_name || answers.business || answers.track_name, "local-account");
  const platform = answers.platform_id || "local";
  return `acct-${base}-${platform}`.replace(/-{2,}/g, "-");
}

export function buildTrackDraftJson(answers) {
  const trackId = shortTrackId(answers);
  const searchDirections = parseLines(answers.search_directions);
  const externalVocab = parseLines(answers.external_vocab);
  const forbiddenTerms = parseLines(answers.forbidden_terms);
  const anxiety = parseLines(answers.anxiety_anchors);
  const proof = parseLines(answers.proof_assets);
  const banned = parseLines(answers.banned_topics);

  return {
    track_id: trackId,
    track_name: answers.track_name || trackId,
    status: "active",
    audience: answers.audience || "",
    product_value: answers.product_value || "",
    anxiety_anchors: anxiety,
    proof_assets: proof,
    commercial_goal: parseLines(answers.commercial_goal),
    banned_topics: banned,
    daily_search_question: searchDirections.length
      ? `过去72小时，有哪些真实热点可以自然连接到这些方向：${searchDirections.join("、")}？`
      : "过去72小时，有哪些真实热点可以自然连接到本赛道客户的真实问题？",
    track_memory: {
      audience: answers.audience || "",
      product_value: answers.product_value || "",
      anxiety_anchors: anxiety,
      proof_assets: proof,
      search_directions: searchDirections,
      banned_topics: banned,
    },
    bridge: {
      internal_lens: answers.product_value || "用产品真实价值判断热点能否自然承载本赛道主张",
      external_vocab: externalVocab,
      forbidden_terms: forbiddenTerms,
      search_directions: searchDirections,
    },
    decision_layer: {
      name: `${trackId}_match_decision`,
      use_when: "判断热点是否能自然连接到本赛道客户焦虑和产品价值",
      skip_when: "热点只有泛流量，无法自然落到客户真实问题或产品价值",
    },
    analysis_layer: {
      name: `${trackId}_content_analysis`,
      use_when: "为非 skip 热点生成桥梁路径、内容角度和风险提醒",
      must_include: ["真实问题", "赛道关系", "产品价值", "平台表达"],
    },
    output_channels: [accountId(answers)],
  };
}

export function buildAccountJson(answers) {
  const track = buildTrackDraftJson(answers);
  const id = accountId(answers);
  const platform = answers.platform_id || "douyin";
  const positioning = answers.positioning_id || "boss";

  return {
    account_id: id,
    tenant_id: "tenant-local",
    display_name: answers.account_name || id,
    track_id: track.track_id,
    platform_id: platform,
    positioning_id: positioning,
    platform_name: PLATFORM_NAMES[platform] || platform,
    positioning_name: POSITIONING_NAMES[positioning] || positioning,
    track_name: track.track_name,
    created_at: new Date().toISOString(),
    memory_updated_at: null,
    memory: {
      business: answers.business || answers.track_name || "",
      audience: answers.audience || "",
      product_value: answers.product_value || "",
      anxiety_anchors: parseLines(answers.anxiety_anchors),
      proof_assets: parseLines(answers.proof_assets),
      commercial_goal: parseLines(answers.commercial_goal),
      content_style: answers.content_style || "",
      extra_external_vocab: parseLines(answers.external_vocab),
      extra_forbidden_terms: parseLines(answers.forbidden_terms),
      banned_topics: parseLines(answers.banned_topics),
      understood: {
        business_understood: answers.business || answers.track_name || "",
        goal_understood: parseLines(answers.commercial_goal).join("、"),
        external_vocab: parseLines(answers.external_vocab),
        forbidden_terms: parseLines(answers.forbidden_terms),
      },
    },
  };
}

export function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}
