<!--
================================================================================
 prompts/新增账号与赛道接入/新增账号与赛道JSON草稿.md · 新增账号 / 新赛道 JSON 起草提示词



================================================================================
 用途：运营拿到老板问卷答案后，用外部 LLM 起草 data/accounts/<account_id>.json；
       如是新赛道，同时起草 config/tracks/<track_id>.json 草稿。

 谁来改：运营 / 工程师。改字段口径时同步 docs/OPERATIONS-LLM-RUNBOOK.md。

 注意：本提示词只起草 JSON，不在线保存、不代表审批通过。保存后必须跑
       python3 scripts/status.py --date <date> --preflight <account_id>
================================================================================
-->

# 任务：根据问卷答案起草账号 JSON 和赛道 JSON 草稿

你是一个内容运营配置助手。请根据我提供的问卷答案，起草可被本地 MVP 使用的 JSON。

## 输入

我会提供：

```text
账号名称：
卖什么 / 服务什么：
卖给谁：
产品最大的好：
证据 / 资产：
客户最焦虑什么：
一定不能碰的话题：
平台：
人设：
说话风格：
已有赛道 ID（如果有）：
是否新赛道：
```

## 输出目标

请输出两段：

1. `account_json`：用于保存到 `data/accounts/<account_id>.json`
2. `track_draft_json`：仅当这是新赛道时输出；用于保存到 `config/tracks/<track_id>.json`

如果已有赛道 ID，就只输出 `account_json`，`track_draft_json` 输出 `null`。

## account_json 字段规则

必须包含：

```json
{
  "account_id": "<acct-...>",
  "tenant_id": "<tenant-...>",
  "display_name": "<账号展示名>",
  "track_id": "<track_id>",
  "platform_id": "<xiaohongshu | douyin | shipinhao | bilibili | youtube>",
  "positioning_id": "<boss | expert | factory-source>",
  "status": "active",
  "platform_name": "<平台中文名>",
  "positioning_name": "<人设中文名>",
  "track_name": "<赛道中文名>",
  "created_at": "<YYYY-MM-DDT00:00:00Z>",
  "memory_updated_at": null,
  "memory": {
    "business": "<卖什么 / 服务什么>",
    "audience": "<卖给谁>",
    "product_value": "<产品最大的好>",
    "anxiety_anchors": ["<客户焦虑1>", "<焦虑2>"],
    "proof_assets": ["<证据1>", "<证据2>"],
    "commercial_goal": ["建立信任", "引流获客"],
    "content_style": "<说话风格>",
    "extra_external_vocab": [],
    "extra_forbidden_terms": ["<不能出现的品牌词/夸张词/内部词>"],
    "banned_topics": ["<不能碰的话题>"],
    "understood": {
      "business_understood": "<一句话复述这门生意>",
      "goal_understood": "<一句话复述运营目标>",
      "external_vocab": ["<受众听得懂的人话词>"],
      "forbidden_terms": ["<对外禁词>"]
    }
  }
}
```

## track_draft_json 字段规则

新赛道时，必须包含：

```json
{
  "track_id": "<track_id>",
  "track_name": "<赛道中文名>",
  "status": "draft",
  "buyer": {
    "who": "<老板 / 主理人身份>",
    "business": "<业务>",
    "scale": "<个人 / 小团队 / 工厂 / 品牌>"
  },
  "buyer_job": "<希望受众相信什么，从而认可内容/产品>",
  "commercial_goal": ["建立信任", "引流获客"],
  "product_value": "<产品最大的好>",
  "proof_assets": ["<证据1>", "<证据2>"],
  "audience": "<目标受众>",
  "daily_search_question": "<每天搜什么热点>",
  "track_memory": {
    "core_concern": ["<核心关注1>", "<核心关注2>"],
    "good_hotspot_signals": ["<什么热点适合>", "<信号2>"],
    "avoid": ["<什么不要碰>"]
  },
  "decision_layer": {
    "strong_pick": "<什么情况必发>",
    "maybe": "<什么情况拍板>",
    "skip": "<什么情况别蹭>"
  },
  "analysis_layer": {
    "name": "<analysis_name>",
    "framework": ["热点事实", "用户真实问题", "赛道关系", "产品价值", "平台表达"]
  },
  "output_channels": ["<account_id>"],
  "anxiety_anchors": ["<客户焦虑1>", "<焦虑2>"],
  "bridge": {
    "internal_lens": "<后台判断视角，不能外显>",
    "external_vocab": ["<对外人话词1>", "<对外人话词2>", "<对外人话词3>"],
    "forbidden_terms": ["远迁移", "far transfer", "OOD", "范式转移"],
    "search_brief": "过去一个月内，有哪些新闻或事件热点，可以自然引出下列话题方向",
    "search_directions": ["<赛道搜索方向1>", "<方向2>", "<方向3>"]
  },
  "example_bridges": [
    {
      "hotspot_hint": "<什么样的热点>",
      "real_problem": "<戳中的真实问题>",
      "track_relation": "<和本赛道的关系>"
    }
  ],
  "version": "draft-v1"
}
```

## 生成要求

- 只根据问卷答案起草，不编造证据。
- `status` 默认：账号用 `active`；新赛道用 `draft`。
- 新赛道草稿必须明确是草稿，不代表正式 approved。
- `account_id` 用小写英文、数字和连字符，例如 `acct-xxx-douyin-boss`。
- `track_id` 用小写英文、数字和连字符，例如 `petfood-sourcing`。
- 平台 ID 只能用：`xiaohongshu`、`douyin`、`shipinhao`、`bilibili`、`youtube`。
- 人设 ID 只能用：`boss`、`expert`、`factory-source`。
- 输出必须是 JSON，不要 Markdown 解释。

## 输出格式

```json
{
  "account_file": "data/accounts/<account_id>.json",
  "account_json": {},
  "track_file": "config/tracks/<track_id>.json",
  "track_draft_json": {}
}
```

如果不是新赛道：

```json
{
  "account_file": "data/accounts/<account_id>.json",
  "account_json": {},
  "track_file": null,
  "track_draft_json": null
}
```
