<!--
================================================================================
 prompts/bridge-directions.md · 入口④ 「热点搜索方向」起草模板（每赛道一次）
================================================================================
 用途：给一个新赛道起草「热点搜索方向」——3-6 条深层母题，写进
       config/tracks/<track_id>.json 的 bridge.search_brief + search_directions（B档定版：赛道文件是方法论唯一来源），供入口① 定向搜索和 match 抬档用。
       注意与 prompts/bridge-motif.md 分工：bridge-motif 起草的是「桥梁母题」
       （internal_lens / external_vocab / forbidden_terms / example_bridges，进 tracks/）；
       本模板起草的是「往外搜什么」。两者都来自同一份业务种子，先跑 bridge-motif，
       再跑本模板（可参考其产出的 internal_lens）。

 谁来改：★博士★。「什么算深层母题」的标准是本系统赛道差异的源头。

 变量占位（agent 照模板手工填，勿删勿改名）：
   {date} {track} {business_seed} {product_value} {proof_assets} {anxiety_anchors}
   {internal_lens}（若 tracks/<id>.json 已有；没有填「暂无」）

 存档：渲染稿存 data/runs/<date>/_onboarding/<track_id>/prompts/directions.txt
       回答存   data/runs/<date>/_onboarding/<track_id>/raw/directions.json
       定稿前 author 必须写「agent 起草，待博士定稿」。
================================================================================
-->

# 任务：为「{track}」赛道起草 3-6 条「热点搜索方向」深层母题

今天是 {date}。业务种子如下：

- 卖什么 / 给谁：{business_seed}
- 产品最大的好：{product_value}
- 能拿出来取信的证据：{proof_assets}
- 客户最焦虑 / 最在意的：{anxiety_anchors}
- 后台理解锚（如已有）：{internal_lens}

<!-- <<< 可编辑区 开始 ================================== 博士在此定母题提炼标准 -->

## 母题提炼标准（在此编辑——这是赛道差异的源头）

一条合格的搜索方向母题，必须同时过三关：

1. **落在机理 / 深层问题层，不是行业泛词。**
   反例：「剃须舒适」「选好剃须刀」。
   正例：「根治或大幅缓解须部假性毛囊炎（解决内生发与红肿）」「稳定经皮水分流失
   （TEWL），重建角质层屏障」。
   检验法：这条母题能不能解释「**什么样的新闻会天然戳中它**」？解释不了就是泛词。

2. **每条 = 一个可成桥的真实问题。**
   向上接热点：写得出 2-3 类会自然引出它的事件；
   向下接产品：产品价值（{product_value}）和证据（{proof_assets}）真的能回应它。
   只有热度入口、产品接不住的，删。

3. **每条都能翻译成对外人话。**
   母题本身可以带专业词（它只在后台搜索和判断用），但必须能写出一句受众听得懂的
   对应说法；翻不出来的是黑话，不是母题。

数量 3-6 条。宁缺毋滥：凑不满 3 条就如实说哪里凑不满、还缺什么业务信息。

<!-- 博士可在此补：本赛道的母题反例、提炼口径偏好…… -->

<!-- <<< 可编辑区 结束 ============================================================ -->

## 输出格式（严格输出下面这个 JSON，不要多余文字）

```json
{
  "track_id": "<track_id>",
  "author": "agent 起草，待博士定稿",
  "search_brief": "过去一个月内，有哪些新闻或事件热点，可以自然引出下列话题方向",
  "directions": [
    "<母题 1，机理层表述>",
    "<母题 2>"
  ],
  "draft_notes": [
    {
      "direction": "<母题原文>",
      "hotspot_hints": "<什么样的新闻会天然戳中它（2-3 类）>",
      "product_link": "<产品凭什么接得住（对上产品价值/证据）>",
      "plain_translation": "<受众听得懂的一句人话>"
    }
  ]
}
```

`directions` 写进 tracks 文件 bridge.search_directions（status 保持 draft 等博士定稿）；`draft_notes` 是论证过程，只留 runs 存档。

## 护栏

- 不复述行业大词（高端、品质、专业……）当母题。
- 不发明业务种子里没有依据的功效或证据。
- 定稿权在博士：本产出落盘后必须明示「待博士定稿后生效」。
