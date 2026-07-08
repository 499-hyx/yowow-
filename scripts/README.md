# scripts/ 目录说明

这里是本地跑批和验收脚本。日常流程以 `docs/RUNBOOK.md` 为准。

## 日常主链路

| 脚本 | 用途 |
|---|---|
| `status.py` | 跑前 `--preflight` 和跑后 full status |
| `make-prompt.py` | 读取账号、赛道、热点，生成 match/generate 提示词 |
| `answer.py` | 可选：调用外部模型自动回答 prompt，写 `_inbox` |
| `cron_llm_email.py` | 可选：给 crond 调用，读最新内容、调用 LLM 生成摘要并发邮件 |
| `daily_pipeline_email.py` | 可选：给 crond/Codex 自动化调用，串起每日完整跑批并发邮件 |
| `ingest.py` | 唯一安装闸门，校验回贴并写 `data/today` |
| `sync-to-db.py` | 默认只 `--dry-run`；正式 sync 必须确认环境或负责人授权 |
| `pull-feedback.py` | 回拉反馈 |

## 维护脚本

| 脚本 | 用途 |
|---|---|
| `validate-configs.mjs` | 校验配置结构 |
| `migrate-to-file-driven.py` | 历史迁移脚本，日常不要重复跑 |
| `mvp_policy.py` | internal MVP 审核状态标记辅助 |

`mvp_policy.py` 是 `status.py`、`make-prompt.py`、`ingest.py` 的共享辅助，不是日常直接入口。

## 红线

- `ingest.py` 是唯一有资格安装 `data/today/<account_id>/latest.json` 的入口。
- 不要把 `sync-to-db.py` 正式同步写成默认日常步骤。
- 不要让脚本为了通过校验去改 schema 或编造热点事实。
