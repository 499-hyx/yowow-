<!--
================================================================================
 prompts/content-generate.md · Step6 内容方案生成模板
================================================================================
 用途：针对「一条热点 × 一条赛道 × 一个平台 × 一个人设」，出一份可发布的内容方案：
       切入角度 / 桥梁逻辑（≥3 条路径）/ 标题 / 开头 / 结构 / 平台适配 / 风险提醒。
       这是 run_engine.py engine_llm 真正调用的模板，产出 = 一条 AdaptationOutput。

 谁来改：老板 / 运营改口吻、结构、风险提醒措辞；博士改桥梁逻辑的方法论。

 变量占位（系统自动填，勿删勿改名，清单见 prompts/README.md §3）：
   {date} {track} {track_json} {product_value} {proof_assets} {anxiety_anchors}
   {bridge_motifs} {internal_lens} {external_vocab} {forbidden_terms}
   {platform} {platform_json} {positioning} {positioning_voice} {hotspot}

 产出按 adaptation-output.schema.json 校验。核心：bridge_paths 走「自然逻辑链 5 步」。
================================================================================
-->

# 任务：为「{track}」在「{platform}」上，用「{positioning}」人设，把这条热点做成一份内容方案

今天是 {date}。

## 这条赛道（产品价值 / 证据 / 客户焦虑 / 桥梁母题）

```json
{track_json}
```

- 产品最大的好：{product_value}
- 能取信于人的：{proof_assets}
- 客户最焦虑 / 最在意：{anxiety_anchors}
- 桥梁母题（对外人话连接概念）：{bridge_motifs}
- 对外可用的人话词：{external_vocab}

## 平台与人设

- 平台：{platform}
```json
{platform_json}
```
- 人设：{positioning}，口吻：{positioning_voice}

## 待适配的中立热点

```json
{hotspot}
```

<!-- <<< 可编辑区 开始 ==================================== 博士 / 老板 / 运营 编辑 -->

## 生成方法论（在此编辑——桥梁逻辑由博士定，口吻 / 结构由老板定）

> 改这里 = 改「怎么从热点搭桥、怎么落成平台内容」。引擎不碰这段。

### 自然逻辑链 5 步（每条 bridge_path 的骨架，主语要写清是谁）

| 步 | 字段 | 写什么（主语） |
|---|---|---|
| 1 现象 | `phenomenon` | 这条热点出现了什么现象（客观） |
| 2 真实问题 | `real_problem` | 这个现象反映受众什么真实焦虑（对上 `{anxiety_anchors}`） |
| 3 赛道关系 | `track_relation` | 这个焦虑和本赛道什么关系（用 `{external_vocab}` / `{bridge_motifs}` 的人话，不用内部锚） |
| 4 产品价值 | `product_value_support` | **这条桥梁路径 / 这个选题**如何支撑本赛道产品价值（主语是这条路径，不是热点本身） |
| 5 平台表达 | `platform_expression` | **这条选题 / 内容**如何落成适合 {platform} 的表达（按平台 content_form + {positioning} 口吻） |

### 出方案时请遵循

1. **先判断能不能接。** 用后台理解锚 `{internal_lens}` 判断自然度。
   连接牵强、要绕很远才搭得上 → 直接 `skip`，`content=null`、`bridge_paths=[]`，绝不硬生成。
2. **能接，就给至少 3 条不同的桥梁路径**，每条都走完整 5 步。从中选最自然的一条
   （`chosen_path_id`）落成成品。
3. **成品要带：** 切入角度（topic）、强钩子标题（按平台 title_logic）、开头（按平台 hook）、
   主体 / 脚本结构（按平台 content_form + length_norm）、{positioning} 的口吻。
4. **风险提醒：** 如果这条选题有「容易踩雷 / 容易显得生蹭 / 容易夸大」的地方，在 `risk_note`
   里给老板提个醒（这是给老板的后台提示，不进成品正文）。

<!-- 老板可在此写：我习惯的开场方式、我不喜欢的表达、本行业的合规红线…… -->

<!-- <<< 可编辑区 结束 ============================================================ -->

## 输出格式（严格输出下面这个 JSON，不要多余文字）

非牵强（strong_pick / maybe）：

```json
{
  "relevance_score": 0.0,
  "naturalness_score": 0.0,
  "recommendation": "strong_pick | maybe",
  "forced_flag": false,
  "skip_reason": null,
  "bridge_paths": [
    {
      "path_id": "p1",
      "phenomenon": "...",
      "real_problem": "...",
      "track_relation": "...",
      "product_value_support": "...",
      "platform_expression": "...",
      "naturalness_note": "<后台说明：这条为何自然，不进成品>"
    }
    // ≥3 条
  ],
  "chosen_path_id": "p1",
  "content": {
    "topic": "<切入角度 / 选题>",
    "title": "<按 {platform} title_logic 的强钩子标题>",
    "body_or_script": "<按 {platform} content_form + {positioning} 口吻的正文 / 脚本，含开头钩子→展开→落点→行动>"
  },
  "external_terms_check": true,
  "risk_note": "<可选：给老板的风险提醒，后台用，不进成品>"
}
```

牵强（skip）：

```json
{
  "relevance_score": 0.0,
  "naturalness_score": 0.0,
  "recommendation": "skip",
  "forced_flag": true,
  "skip_reason": "<一句人话：为什么不建议蹭，零内部术语>",
  "bridge_paths": [],
  "chosen_path_id": null,
  "content": null,
  "external_terms_check": true
}
```

## 护栏（系统会自动校验，违反即被拦）

1. **零禁词**：`content` 的 topic / title / body_or_script 里**绝不能**出现 `{forbidden_terms}` 里的任何词，
   也不能出现内部理解锚 `{internal_lens}`（如 far transfer / 远迁移 / OOD / 范式转移）。出现即不合格。
2. **牵强即 skip**：连接牵强就 `recommendation=skip`、`content=null`、`bridge_paths=[]`，绝不硬生成。
3. **非 skip 必须 ≥3 条 bridge_paths**，每条 5 步字段齐全；`chosen_path_id` 指向其中一条。
4. **不夸大、不编造**：只用 `{proof_assets}` 里真实能拿出来的证据，不编功效、不下绝对承诺。
5. `internal_lens` 只用于后台判断自然度，**判断完绝不写进任何对外字段**。
