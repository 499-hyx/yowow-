// T-M4.0（暖启动）· 静态示例内容种子（博士决策 B：先放少量静态 JSON 让 owner 进来给反馈）。
// 这是「少量静态 JSON」——不接 LLM、不查 Turso，让 /today 与引导最后一屏当场有真内容可看可评。
// 内容取自已验证的 petfood 样板（skills/adaptation-engine/replays/petfood-*）。
// 部署窗口接通 run_engine 的 llm 后端后，这层自然被「按需生成 + 缓存」取代（call-by-need 终态）。
// 加别的赛道样板（如教育）= 照此再加一份 seed，不改引擎（I9）。

import type {
  AccountProfile,
  AdaptationOutput,
  FirstContentResult,
  HotspotMetaMap,
} from "@/lib/adaptation-types";
import type { TodayResponse } from "@/lib/api-contracts";

const ACCOUNT: AccountProfile = {
  account_id: "acct-petfood-douyin-boss",
  tenant_id: "tenant-petfood-demo",
  display_name: "宠物口粮 · 抖音老板号（样板）",
  track_id: "petfood-sourcing",
  platform_id: "douyin",
  positioning_id: "boss",
  status: "active",
};

const PETLABEL: AdaptationOutput = {
  hotspot_id: "hs-demo-petlabel-20260606",
  track_id: "petfood-sourcing",
  platform_id: "douyin",
  positioning_id: "boss",
  recommendation: "strong_pick",
  forced_flag: false,
  skip_reason: null,
  chosen_path_id: "p1",
  bridge_paths: [
    {
      path_id: "p1",
      phenomenon: "养宠人开始互相教「主粮配料表第一位要看是不是肉」，看成分火了。",
      real_problem: "大家不是想当专家，是怕花了钱还喂错、伤了当家的猫狗。",
      track_relation: "宠物食品好不好，就藏在配料表和来源里——这正是养宠人自己能看懂、能掌控的部分。",
      product_value_support: "把配料第一位、原料从哪来、检测报告摆出来，让人不用赌运气就能喂得安心。",
      platform_expression: "老板口吻直给：选粮别看广告，先翻到配料表第一行——是肉就有谱。",
    },
    {
      path_id: "p2",
      phenomenon: "评论区都在问「这粮配料表能信吗、第一位写肉是不是文字游戏」。",
      real_problem: "看不懂成分表的排列规则，容易被「肉」的字面话术带过去。",
      track_relation: "把配料表怎么看、含量怎么排讲清楚，是源头敢被人盯着看的底气。",
      product_value_support: "用工厂实拍和检测报告对上配料表，证明写出来的就是袋子里的。",
      platform_expression: "一句话教你识破配料表文字游戏，看这三个位置就够了。",
    },
    {
      path_id: "p3",
      phenomenon: "越来越多人说「不再冲网红粮的牌子，改看成分和复购」。",
      real_problem: "为牌子和广告多花的钱，不一定花在毛孩子的碗里。",
      track_relation: "把钱花在查得到的原料和品质上，比花在牌子上更让养宠人安心。",
      product_value_support: "源头同样的料、价格更实在，把省下的牌子溢价换成看得见的用料。",
      platform_expression: "落点给行动：别冲牌子，先看配料表和复购率，再决定喂不喂。",
    },
  ],
  content: {
    topic: "选猫狗主粮，别看广告先翻配料表第一行",
    title: "买宠物粮别再冲牌子了，先翻到配料表第一行看一眼",
    body_or_script:
      "（前3秒）现在养宠的都学聪明了——选主粮不看广告，先翻到配料表第一行。\n" +
      "（冲突）袋子正面印得再好看，都不如配料表第一位写的是肉还是谷物实在。你喂的是毛孩子，不是那张包装。\n" +
      "（展开）配料表按含量从多到少排，第一位是肉基本盘就稳；一堆谷物和「肉粉」打头，再贵也别急着信。\n" +
      "（落点）买之前就看三点：配料表第一位、原料从哪来、有没有能对上的检测。\n" +
      "（行动）评论区发出你家正在喂的牌子，我帮你看配料表第一行写的是啥。",
  },
  external_terms_check: true,
};

const NIKE: AdaptationOutput = {
  hotspot_id: "hs-demo-nike-20260606",
  track_id: "petfood-sourcing",
  platform_id: "douyin",
  positioning_id: "boss",
  recommendation: "maybe",
  forced_flag: false,
  skip_reason: null,
  chosen_path_id: "p1",
  bridge_paths: [
    {
      path_id: "p1",
      phenomenon: "耐克连跌七个季度，评论区都在说「不想再为一个标多花钱」。",
      real_problem: "大家要的是真东西、真好用，而不是牌子带来的心理安慰。",
      track_relation: "养宠一个道理：网红粮好不好，跟牌子大不大没多大关系，得看配料和来源。",
      product_value_support: "把钱花在查得到的原料和品质上，而不是花在那个标上。",
      platform_expression: "老板口吻直给：大牌都祛魅了，给毛孩子选粮更别只认牌子。",
    },
    {
      path_id: "p2",
      phenomenon: "曾经最稳的大牌也会连跌、被换掉。",
      real_problem: "牌子大不等于一直对，谁不进步谁出局。",
      track_relation: "宠物食品也在洗牌，老牌子不代表更适合你家猫狗的肠胃。",
      product_value_support: "用配料表和真实饲喂反馈说话，让养宠人自己判断。",
      platform_expression: "我做这行，看的是猫狗吃得好不好，不是看谁名气大。",
    },
    {
      path_id: "p3",
      phenomenon: "评论区在吵国货和性价比。",
      real_problem: "买东西最怕踩雷，花对钱比花贵钱更让人安心。",
      track_relation: "买宠物粮最怕踩雷，把配料来源讲清楚就是帮人买对、不买贵。",
      product_value_support: "把「怎么不踩雷」讲清楚，本身就是源头的底气。",
      platform_expression: "落点给行动：别为牌子多掏钱，先看配料表这三点再买。",
    },
  ],
  content: {
    topic: "大牌都祛魅了，给毛孩子选粮更别只认牌子",
    title: "耐克都连跌七个季度了，你还在为牌子给猫狗买粮?",
    body_or_script:
      "（前3秒）耐克在中国连跌七个季度，大家突然想明白：不想再为一个标多花钱了。\n" +
      "（冲突）给猫狗选粮更是这样。你买的是配料表里那点真东西，不是包装上的网红名字。\n" +
      "（落点）买之前就看三点：配料表第一位、原料从哪来、有没有真实饲喂反馈。对得上，它就是好粮。",
  },
  external_terms_check: true,
};

const CELEB: AdaptationOutput = {
  hotspot_id: "hs-demo-celeb-20260606",
  track_id: "petfood-sourcing",
  platform_id: "douyin",
  positioning_id: "boss",
  recommendation: "skip",
  forced_flag: true,
  skip_reason:
    "韩庚鹿晗朝鲜族服饰同框是明星情怀向热点，跟宠物口粮只能靠「明星养宠/同款」硬扯，桥要绕很远，发出去像生蹭流量、伤号，已帮你跳过。",
  bridge_paths: [],
  chosen_path_id: null,
  content: null,
  external_terms_check: true,
};

const META: HotspotMetaMap = {
  "hs-demo-petlabel-20260606": {
    oneLiner: "「看配料表第一位」成养宠人选粮共识",
    reason: "今天这条戳的是「怕花了钱还喂错、伤了猫狗」，正好接你的「配料看得懂、来源查得到」。",
  },
  "hs-demo-nike-20260606": {
    oneLiner: "耐克连跌七季，大家不想再为一个标多花钱",
    reason: "能接，但角度有点绕，给你几条路径自己挑。",
  },
  "hs-demo-celeb-20260606": {
    oneLiner: "韩庚鹿晗朝鲜族服饰同框",
    reason: "明星情怀向，跟你卖的硬扯才连得上，帮你跳了。",
  },
};

export const WARM_START_TODAY: TodayResponse = {
  account: ACCOUNT,
  board: { picks: [PETLABEL, NIKE], also_ran: [], skipped: [CELEB] },
  meta: META,
};

export const WARM_START_FIRST_CONTENT: FirstContentResult = {
  status: "ready",
  output: PETLABEL,
  hotspot: "hs-demo-petlabel-20260606",
  message: "这是替你写的第一条",
};
