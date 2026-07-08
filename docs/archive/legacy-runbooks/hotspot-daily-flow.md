# 每日热点内容生产流程

> 归档说明：这是历史日流程文档。当前日常跑批以 `docs/RUNBOOK.md` 为准，工程交接以 `docs/MVP-ARCHITECTURE-HANDOFF.md` 为准。

本文只说明每天重复跑的流程。新赛道第一次接入见 `docs/track-onboarding-flow.md`。

核心模型：

```text
公共热点池
+
赛道专属热点池
+
赛道记忆判断
+
赛道分析层
+
前端发布
```

系统不是账号驱动，而是赛道驱动。正确问题是：“某个赛道今天有哪些热点值得用它自己的分析层解释？”账号只是最后发布渠道。

## 1. 公共热点池 broad pool

公共池每天抓一次，所有赛道共用。

它回答：

```text
过去 24-72 小时，中国主要互联网平台最大的流量热点是什么？
```

覆盖微博、抖音、小红书、B站、知乎、百度热搜、头条、快手、公众号/媒体等主要来源。

输出位置：

```text
data/hotspots/YYYY-MM-DD.json
```

公共池只做全网大流量召回，不做赛道判断，不写内容方案。

## 2. 赛道专属热点池 track pool

每个 `status=approved` 或 `status=reference` 的赛道每天都要跑一次赛道池。

赛道池使用 `config/tracks/<track_id>.json` 里的 `daily_search_question` 或 `bridge.search_directions`，补充公共池抓不到的赛道高相关热点。

输出位置：

```text
data/hotspots/tracks/<track_id>/YYYY-MM-DD.json
```

赛道池只属于对应赛道，不回灌公共池。

## 3. 赛道记忆判断 track decision

每个赛道合并两池：

```text
data/hotspots/YYYY-MM-DD.json
+
data/hotspots/tracks/<track_id>/YYYY-MM-DD.json
```

合并后按 `hotspot_id` 去重，再使用该赛道自己的配置判断：

- `track_memory`
- `decision_layer`
- `avoid_topics` / `analysis_doctrine.no_touch`
- `content_principles`

判断结果只有三档：

- `strong_pick`
- `maybe`
- `skip`

概念输出位置：

```text
data/runs/YYYY-MM-DD/tracks/<track_id>/decisions/
```

当前脚本仍兼容账号目录：

```text
data/runs/YYYY-MM-DD/<account_id>/_inbox/match-<hotspot_id>.json
```

无论存在哪里，这一步概念上都属于 track decision，不是账号凭感觉挑选。

## 4. 赛道分析层 track analysis

只有 `strong_pick` / `maybe` 进入分析层。`skip` 不生成内容，不进入可发区。

每条赛道必须有自己的 `analysis_layer`。通用 `content-generate.md` 可以作为输出外壳，但真正的判断框架来自赛道配置。

概念输出位置：

```text
data/runs/YYYY-MM-DD/tracks/<track_id>/analysis/
```

当前脚本仍兼容账号目录：

```text
data/runs/YYYY-MM-DD/<account_id>/_inbox/generate-<hotspot_id>.json
```

## 5. 前端发布 front-end install

最后由 `scripts/ingest.py` 或明确的 install 脚本把可发布内容安装到前端读取目录：

```text
data/today/<account_id>/YYYY-MM-DD.json
data/today/<account_id>/latest.json
```

`data/today` 不允许手动改。账号只是发布渠道；内容判断和分析核心仍来自 track。

## daily flow 不使用 bridge

每日流程不使用：

- `prompts/bridge-motif.md`
- `prompts/bridge-directions.md`

这两个文件只属于新赛道第一次接入。daily status 也不应该把 bridge 结果或新赛道接入文档当成当天缺项。

## 提示词分工

| 提示词 | 使用时机 | 说明 |
|---|---|---|
| `bridge-motif.md` | 新赛道第一次接入 | 起草桥梁母题；每天不用 |
| `bridge-directions.md` | 新赛道第一次接入 | 起草赛道搜索方向；每天不用 |
| `hotspot-broad.md` | 每天一次 | 抓公共热点池 |
| `hotspot-search.md` | 每个 approved/reference 赛道每天一次 | 抓赛道专属热点池 |
| `neutralize.md` | 热点入池前 | 中立富化，缺料就标待人工 |
| `hotspot-match.md` | 每天，每条热点 × 赛道 | 做赛道记忆判断，输出 `strong_pick` / `maybe` / `skip` |
| `content-generate.md` | 每天，非 skip 热点 | 生成发布内容，但必须调用或包含赛道自己的 `analysis_layer` |
| `daily-summary.md` | 每日收尾，可选 | 汇总当天结果 |
