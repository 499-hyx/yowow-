# 每日运营五步跑批流程

目标：每天把人工跑 LLM 的操作压到 15 分钟内，并保证坏回贴永远进不了网站。

网站只读 `data/` 目录，不依赖在线 LLM。运营每天做的是：更新热点、生成提示词、把提示词交给外部 LLM、用 `ingest.py` 收回贴并安装、刷新网站。

---

## 1. 存热点

把当天热点写入：

```text
data/hotspots/YYYY-MM-DD.json
```

格式参考 `config/today-hotspots.demo.json`。每条至少要有：

```text
hotspot_id / title / summary / heat_score_10 / platforms
```

示例：

```bash
cd yowow-adaptation
ls data/hotspots/2026-06-10.json
```

---

## 2. 生成提示词

每个账号跑一次：

```bash
cd yowow-adaptation
python3 scripts/make-prompt.py acct-razor-douyin-boss --date 2026-06-10 --step all
```

输出位置：

```text
data/runs/2026-06-10/acct-razor-douyin-boss/prompts/match-<hotspot_id>.txt
data/runs/2026-06-10/acct-razor-douyin-boss/prompts/generate-<hotspot_id>.txt
data/runs/2026-06-10/acct-razor-douyin-boss/manifest.json
```

`make-prompt.py` 会自动把账号记忆、赛道、平台、人设、热点拼进提示词；占位符替换只走白名单，示例 JSON 的花括号不会被误替换。

自测：

```bash
python3 scripts/make-prompt.py --selftest
```

---

## 3. 外部 LLM

把 `prompts/` 里的每个 `.txt` 粘给外部 LLM。回贴保存到：

```text
data/runs/YYYY-MM-DD/<account_id>/raw/match-<hotspot_id>.json
data/runs/YYYY-MM-DD/<account_id>/raw/generate-<hotspot_id>.json
```

建议顺序：

```text
1. 先跑 match-*.txt，得到 strong_pick / maybe / skip
2. skip 的热点不用再跑 generate
3. strong_pick / maybe 再跑 generate-*.txt
```

文件名里的 `<hotspot_id>` 必须和热点文件一致。回贴前后有多余文字、Markdown 围栏都可以，`ingest.py` 会抽出第一个 JSON 对象。

---

## 4. 收回贴并安装

```bash
python3 scripts/ingest.py acct-razor-douyin-boss \
  data/runs/2026-06-10/acct-razor-douyin-boss/raw \
  --date 2026-06-10
```

如果今日页导出了反馈 JSON，把它一起归档：

```bash
python3 scripts/ingest.py acct-razor-douyin-boss \
  data/runs/2026-06-10/acct-razor-douyin-boss/raw \
  --date 2026-06-10 \
  --feedback ~/Downloads/today-feedback.json
```

成功后写入：

```text
data/today/<account_id>/YYYY-MM-DD.json
data/today/<account_id>/latest.json
data/runs/YYYY-MM-DD/<account_id>/installed.json
data/runs/YYYY-MM-DD/<account_id>/manifest.json
data/runs/YYYY-MM-DD/<account_id>/raw/
```

`ingest.py` 的硬门：

- JSON 抽不出来：拒收。
- match 结果缺 `tier` / `skip_reason`：拒收。
- generate 结果缺 AdaptationOutput 必填字段：拒收。
- non-skip 少于 3 条 `bridge_paths` 或桥梁 5 步缺字段：拒收。
- 回贴里的 `hotspot_id / track_id / platform_id / positioning_id` 与账号不一致：拒收。
- generate 档位高于 match 档位：自动封顶。
- 成品命中内部术语、赛道禁词、账号禁词：降级 skip，不进入可发区。

自测：

```bash
python3 scripts/ingest.py --selftest
```

---

## 5. 刷新网站

本地：

```bash
cd yowow-adaptation
npm run dev
```

打开 `http://localhost:3000`，进入账号工作台和今日推荐。

上线前建议跑：

```bash
python3 scripts/make-prompt.py --selftest
python3 scripts/ingest.py --selftest
npm run typecheck
npm run build
cd ..
python3 adaptation-core/verify.py
```

---

## 常见报错

| 报错 | 原因 | 处理 |
|---|---|---|
| `JSON 抽取失败` | LLM 回贴里没有完整 JSON，或花括号不配对 | 让 LLM 只重发 JSON；不要手工删字段 |
| `无法判断是 match 还是 generate` | 回贴既没有 `tier`，也没有 `recommendation + bridge_paths` | 确认粘的是对应 prompt 的输出格式 |
| `match 结果缺少 skip_reason` | match JSON 少字段 | 让 LLM 按 match 模板重发完整 JSON |
| `non-skip 至少需要 3 条 bridge_paths` | generate 给的桥梁不足 | 重跑 generate，要求补齐 3 条路径 |
| `bridge_paths[i] 缺 5 步字段` | 某条路径没写完整自然逻辑链 | 重跑 generate，要求每条补齐 5 个字段 |
| `track_id/platform_id/positioning_id 不一致` | 回贴串了账号，或模型自己编了 id | 检查文件名和账号；必要时重跑 prompt |
| `hotspot_id 不在 data/hotspots/YYYY-MM-DD.json 中` | 回贴对应的热点不属于当天热点文件 | 用当天 prompts 重新跑，或补齐热点文件 |
| `成品没过用词自检` | content 或桥梁外显字段命中内部词、赛道禁词、账号禁词 | 改提示词回贴中的具体外显字段，避开命中的词 |

---

## 新增账号

1. 访问 `/onboarding`，走完向导，末步下载账号 JSON。
2. 把下载的 `<account_id>.json` 放进 `data/accounts/`。
3. 刷新首页，新账号会出现在工作台。
4. 按五步流程为这个账号跑批。

## 修改账号记忆

直接编辑：

```text
data/accounts/<account_id>.json
```

修改 `memory` 字段后保存。下次跑 `make-prompt.py` 时，新记忆会自动进入提示词。
