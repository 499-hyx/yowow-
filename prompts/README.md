# prompts/ · 可编辑提示词层（博士 / 老板的「脑子」放这里）

> **这一层是给人改的，不是给程序改的。**
> 系统所有需要 LLM 思考的环节，提示词都抽成了这个目录下的 `.md` 模板。
> 博士、老板要调方法论、改口吻、换措辞，**只改这里的文件，不用碰任何引擎代码**。
> 引擎（`skills/adaptation-engine/run_engine.py` 等）只负责：读模板 → 把变量填进去 → 调 LLM。
> 引擎里**没有一句方法论、没有一条桥梁内容**——全部「脑子」只存在于本目录 + `tracks/*.json`。

---

## 1. 四个环节，四个文件

| 文件 | 对应六步流程的哪一步 | 谁主要在这里写 | 干什么 |
|---|---|---|---|
| `bridge-motif.md` | **Step4 桥梁母题** | **博士**（方法论） | 给一个新赛道起草「桥梁母题」——这条赛道用什么视角把热点接到自己的产品价值上 |
| `neutralize.md` | 热点中立化 | 博士 / 老板 | 把抓到的原始热点，抽成中立的「现象 / 情绪 / 人群 / 冲突 / 候选问题」（缺料就标待人工，绝不编） |
| `hotspot-match.md` | **Step5 热点筛选** | 博士 / 老板 | 判断某条热点跟某赛道的相关性，分三档：高匹配 / 可尝试 / 不建议蹭 |
| `content-generate.md` | **Step6 内容生成** | 老板 / 运营 | 出方案：切入角度、桥梁逻辑、标题、开头、结构、平台适配、风险提醒 |

---

## 2. 怎么改（给博士 / 老板看）

1. 用任何文本编辑器打开对应的 `.md` 文件。
2. 文件里有两种内容：
   - **普通说明文字** —— 给 LLM 的指令，可以照常改。
   - **`<<< 可编辑区 开始 >>>` … `<<< 可编辑区 结束 >>>`** —— 这是**最该由你来写**的方法论 / 口吻区。重点改这里。
3. **变量占位**写成花括号形式，例如 `{track}`、`{hotspot}`、`{forbidden_terms}`（见下方第 3 节）。
   系统运行时会自动把真实内容填进这些花括号。**不要删占位符**，也不要把它们翻译成别的写法，否则填不进去。
4. 保存即可。下次系统跑这个环节，就用你改后的提示词。**不需要改代码、不需要重新部署引擎逻辑**（生产环境改完模板文件重新发布静态资源即可）。

> 小贴士：想试改的效果，让技术同学跑一句
> `python3 skills/adaptation-engine/prompt_loader.py --preview content-generate` ——
> 会把模板 + 一份样例变量渲染出来给你看，所见即所得。

---

## 3. 变量占位约定（系统会自动替换；占位符大小写、拼写必须照抄）

> 规则：模板里凡是写成 `{名字}` 且名字在下表里的，运行时会被替换成真实值。
> **不在下表里的花括号（比如示例 JSON 里的 `{ }`）不会被动**，可以放心在示例里写 JSON。

| 占位符 | 含义 | 从哪来 | 出现在 |
|---|---|---|---|
| `{date}` | 当天日期 YYYY-MM-DD | 系统 | 各文件 |
| `{track}` | 赛道名（如「儿童 AI 教育」） | `tracks/<id>.json` `track_name` | match / generate / bridge-motif |
| `{track_json}` | 整份赛道配置（JSON） | `tracks/<id>.json` | match / generate |
| `{business_seed}` | 新赛道的业务种子（卖什么、给谁、价值、证据、焦虑） | onboarding 7 问答案 | **bridge-motif** |
| `{product_value}` | 这条赛道产品最大的好 | `track.product_value` | generate / bridge-motif |
| `{proof_assets}` | 能拿出来取信于人的东西 | `track.proof_assets` | generate / bridge-motif |
| `{anxiety_anchors}` | 客户最焦虑 / 最在意什么 | `track.anxiety_anchors` | match / generate / bridge-motif |
| `{bridge_motifs}` | **桥梁母题**：这条赛道对外用的人话连接概念 | `track.bridge.external_vocab` + `track.example_bridges` | generate（也是 bridge-motif 的产出） |
| `{internal_lens}` | **内部理解锚**（后台判断视角，如 far transfer） | `track.bridge.internal_lens` | match / generate（**只后台，绝不进成品**） |
| `{external_vocab}` | 对外可用的人话词 | `track.bridge.external_vocab` | generate / bridge-motif |
| `{forbidden_terms}` | **对外绝对禁词**（出现即不合格） | `track.bridge.forbidden_terms` + 账号 `overrides.extra_forbidden_terms` | match / generate / bridge-motif |
| `{platform}` | 平台名（抖音 / 小红书 / 视频号） | `platforms/<id>.json` `platform_name` | generate |
| `{platform_json}` | 整份平台配置（content_form / hook / title_logic …） | `platforms/<id>.json` | generate |
| `{positioning}` | 人设名（老板型 / 专家型 / 工厂源头型） | `positionings/<id>.json` | generate |
| `{positioning_voice}` | 该人设的口吻（如「直接、有主见、讲取舍」） | `positionings/<id>.json` `voice` | generate |
| `{hotspot}` | 整条中立热点（JSON） | `neutral_hotspot` | match / generate |
| `{hotspot_raw}` | 原始抓取候选（fetch-v1，含原料） | 抓取层 | **neutralize** |
| `{hotspot_title}` | 热点标题 | 热点 `title` | 各文件 |

> 维护者注：占位符的「权威清单」在 `skills/adaptation-engine/prompt_loader.py` 的 `KNOWN_PLACEHOLDERS`。
> 加新占位符时，**先在那里登记**，再在本表补一行，并在引擎装配处（`assemble()` / 各环节）提供对应值。

---

## 4. 三条护栏（系统会强制校验，提示词措辞由你定，但底线不可破）

这三条是**系统级红线**，写进了 `adaptation-core/verify.py` 和发布前硬门。
你在提示词里怎么措辞都行，但 LLM 的产出必须满足，否则会被自动拦下：

1. **牵强即跳过**：热点和赛道连不上、要绕很远才搭得上，就直接判 `skip`、不出内容，绝不硬掰。
2. **内部理解锚不外显**：`{internal_lens}`（如 far transfer / 远迁移 / OOD）只用于后台判断自然度，**绝不能出现在给用户看的成品里**。
3. **合规不夸大 + 零禁词**：成品里不得出现 `{forbidden_terms}` 里的任何词；不编造、不夸大功效。

> 这三条是「护栏」，不是「方法论」。方法论（怎样才算自然成桥、这条赛道独有的视角）由**你**写在各文件的可编辑区和 `tracks/*.json` 里。

---

## 5. 和配置文件的分工

- **`tracks/<id>.json`** = 一条赛道的「档案」（卖什么、给谁、桥梁母题、内部锚、禁词、示例桥）。改一条赛道的**事实和词表**，改这里。
- **`prompts/*.md`** = 通用的「怎么想、怎么写」模板，对所有赛道复用。改**思考方式 / 输出格式 / 口吻要求**，改这里。
- 换一个全新赛道 = 加一份 `tracks/<新id>.json`（可用 `bridge-motif.md` 起草）+ 不改任何 `prompts/*.md`、不改任何引擎代码。
