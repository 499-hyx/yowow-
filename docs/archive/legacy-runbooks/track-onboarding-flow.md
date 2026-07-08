# 新赛道第一次接入流程

> 归档说明：这是历史新赛道接入文档。当前 `/onboarding` 定位和手工保存 JSON 流程以 `docs/MVP-ARCHITECTURE-HANDOFF.md` 与 `docs/RUNBOOK.md` 为准。

本文只说明“第一次创建一个新赛道”怎么做。日常抓热点、筛热点、生成内容不属于本文流程，见 `docs/hotspot-daily-flow.md`。

## 什么时候需要创建新赛道

当一个业务不能复用现有 `config/tracks/<track_id>.json` 的方法论、目标受众、判断标准和分析层时，才创建新赛道。

账号不是系统核心。账号只是最后的发布渠道；赛道才定义“什么热点值得解释、用什么分析层解释、什么内容不能碰”。

已有赛道新增账号时，不新建赛道，只新增账号配置，并让账号指向已有 `track_id`。

## 一次性接入产物

新赛道接入完成后，至少要有：

- `config/tracks/<track_id>.json`
- `docs/<track_id>-standard.md`

`config/tracks/<track_id>.json` 是机器读取的事实源；`docs/<track_id>-standard.md` 是人读的标杆说明，解释这条赛道每天怎么跑、为什么这么判断。

## bridge 提示词的作用

`prompts/bridge-motif.md` 只在新赛道第一次接入时使用，用来起草这条赛道的桥梁母题、对外词表、禁词和自然连接样例。

`prompts/bridge-directions.md` 只在新赛道第一次接入时使用，用来起草这条赛道的定向搜索方向，也就是日后每天生成赛道专属热点池时要问的问题来源。

赛道 `status=approved` 后，日常流程不再依赖 `bridge-motif.md` 和 `bridge-directions.md`。如果要重写赛道方法论或搜索方向，应把赛道退回 `draft`，重新起草并交博士定稿。

## tracks 文件必要字段

新赛道配置至少要表达这些边界：

- `track_id` / `track_name`
- `status`
- `audience`
- `daily_search_question`
- `track_memory`
- `decision_layer`
- `analysis_layer`
- `output_channels`
- `bridge.internal_lens`
- `bridge.external_vocab`
- `bridge.forbidden_terms`
- `bridge.search_directions`
- `example_bridges`
- `product_value`
- `proof_assets`
- `commercial_goal`

旧字段不要删除；新字段以 additive 方式补充。schema 或校验脚本已有要求时，以校验脚本为准。

## status 含义

- `draft`：已起草但未定稿。不能进入日常跑批，不能生成前端 today。
- `approved`：博士或负责人已定稿。每天进入公共池 + 赛道池 + 赛道判断 + 赛道分析 + 前端发布流程。
- `reference`：历史兼容状态，视同已定稿；新配置优先使用 `approved`。
- `paused`：暂时不跑日常流程。配置保留，但 daily status 不要求当天产物。

## 接入完成标准

一条新赛道接入完成，必须同时满足：

- `config/tracks/<track_id>.json` 通过配置校验。
- 赛道有明确 `daily_search_question`，能每天召回赛道专属热点池。
- 赛道有 `track_memory`，能判断什么值得发、什么该跳过。
- 赛道有 `decision_layer`，能区分 `strong_pick` / `maybe` / `skip`。
- 赛道有 `analysis_layer`，非 skip 热点知道按哪套分析框架展开。
- 赛道有 `output_channels`，明确哪些账号只是发布渠道。
- 人读标准文档解释清楚这条赛道如何复制。

完成后，把 `status` 改为 `approved`。此后每天只走 daily flow，不再把 bridge 起草当成日常缺项。
