# education-yowow 标杆赛道

`education-yowow` 是第一个可复制的标杆赛道。它第一次接入只做一次；定稿后每天只走 `docs/RUNBOOK.md` 的日常跑批流程，不再用 bridge 起草流程。

当前状态：`approved`。

## 赛道定位

`education-yowow` 面向儿童 AI 教育内容与产品。它不是普通教育新闻账号，也不是泛亲子情绪号，而是把社会热点翻译成“AI 时代孩子需要什么学习能力”的判断框架。

系统里账号不是核心。`acct-xiaozhu-edu-xhs` 只是这条赛道在小红书上的发布渠道；赛道配置才决定什么热点值得分析、用什么分析层分析、哪些词和话题不能碰。

## 目标受众

中国小学阶段孩子家长。

他们关心：

- 孩子未来能力
- 家长教育焦虑
- 学习迁移能力
- AI 时代的认知重塑
- 怎么陪孩子面对陌生问题

## daily_search_question

```text
过去72小时，有哪些中国小学家长感兴趣的热点，适合用认知神经科学 far transfer 的视角加以剖析？
```

这句话用于每天生成 `education-yowow` 的赛道专属热点池。

## track_memory

核心关切：

- 孩子未来能力
- 家长教育焦虑
- 学习迁移能力
- AI时代的认知重塑
- 远迁移 far transfer

好热点信号：

- 能引出孩子能力结构变化
- 能解释家长焦虑背后的认知误区
- 能从社会热点转译成教育判断
- 适合小红书家长传播

避开：

- 纯政策汇编
- 纯鸡汤
- 硬蹭灾难
- 把神经科学结论说得过满
- 没有教育转译空间的娱乐热点

## decision_layer

- `strong_pick`：热点与小学家长强相关，且能用 far transfer 或认知发展视角产生独特解释。
- `maybe`：热点有教育转译空间，但角度需要进一步打磨。
- `skip`：热点流量虽大，但与赛道弱相关或只能硬蹭。

判断时先筛后析。命中不碰清单、细节不足、或和赛道八竿子打不着，就直接 `skip`。

## far_transfer_analysis_layer

分析层名称：

```text
far_transfer_analysis
```

分析框架：

1. 热点事实
2. 家长为什么会关心
3. 孩子能力结构问题
4. far transfer 视角剖析
5. 教育误区纠偏
6. 给家长的行动建议
7. 与 YOWOW 教育理念的自然连接

这一步不是新闻摘要，也不是通用写作。`prompts/分析提示词/内容生成.md` 只能作为外壳，必须吃进这条赛道的分析层。

## output_channels

```text
acct-xiaozhu-edu-xhs
```

后续新增同赛道账号时，只新增账号配置并指向 `education-yowow`，不要复制赛道方法论到账号记忆里。

## 每日流程

1. 公共池：读取 `data/hotspots/YYYY-MM-DD.json`，召回全网大流量热点。
2. education-yowow 专属池：读取 `data/hotspots/tracks/education-yowow/YYYY-MM-DD.json`，召回小学家长高相关热点。
3. 赛道记忆判断：合并两池，用 `track_memory` / `decision_layer` / `analysis_doctrine` 判 `strong_pick` / `maybe` / `skip`。
4. far transfer 分析：只对非 skip 热点进入 `far_transfer_analysis`。
5. 前端发布：由 `scripts/ingest.py` 安装到 `data/today/<account_id>/YYYY-MM-DD.json` 和 `latest.json`。

## 新赛道如何复制

新增赛道时，不要从账号问题开始，而要先回答：

```text
这条赛道今天有哪些热点值得用它自己的分析层解释？
```

复制 `education-yowow` 时保留结构，替换内容：

- 换 `daily_search_question`
- 换 `track_memory`
- 换 `decision_layer`
- 换 `analysis_layer`
- 换 `output_channels`
- 换 `bridge.internal_lens` / `external_vocab` / `forbidden_terms` / `search_directions`
- 写新的 `docs/<track_id>-standard.md`

赛道 `status=approved` 后，每天只走 daily flow，不再把 `bridge-motif.md` 或 `bridge-directions.md` 当成每日步骤。
