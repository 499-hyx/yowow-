# Cron LLM Email

目标：先用 Linux `crond` 跑一个独立任务，完成每日链路并邮件通知：

```text
刷新热点提示词并生成热点池 → 生成 match 提示词 → LLM 回答 match → 生成 generate 提示词
→ LLM 回答 generate → ingest 安装 → latest.json 前端数据检查 → 邮件摘要
```

这个任务不放进 Vercel/Next.js，不写 Turso，不在线生成页面内容。它属于运营侧离线任务。

## 环境变量

参考 `.env.cron.example`。生产环境不要把真实 key 提交进 git。

LLM 默认使用 Anthropic：

```bash
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=...
export MODEL_NAME=claude-sonnet-4-6
```

也可以使用 OpenAI-compatible API：

```bash
export LLM_PROVIDER=openai
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://api.openai.com/v1
export MODEL_NAME=...
```

豆包/火山方舟走 OpenAI-compatible 模式：

```bash
export LLM_PROVIDER=doubao
export DOUBAO_API_KEY=...
export DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
export MODEL_NAME=doubao-seed-2-0-lite-260428
```

SMTP：

```bash
export SMTP_HOST=smtp.example.com
export SMTP_PORT=587
export SMTP_USE_TLS=1
export SMTP_USERNAME=...
export SMTP_PASSWORD=...
export EMAIL_FROM=ops@example.com
export EMAIL_TO=owner@example.com,editor@example.com
```

每日完整链路：

```bash
export DAILY_PIPELINE_ACCOUNTS=acct-xiaozhu-edu-xhs,acct-razor-douyin-boss
```

留空则跑 `data/accounts/*.json` 里的全部账号。

## 本地验证

```bash
cd /path/to/yowow-adaptation
python3 scripts/cron_llm_email.py --selftest
python3 scripts/cron_llm_email.py --dry-run --no-llm
python3 scripts/generate_hotspot_pool.py --selftest
python3 scripts/daily_pipeline_email.py --selftest
python3 scripts/daily_pipeline_email.py --dry-run --date 2026-07-07 --accounts acct-xiaozhu-edu-xhs
```

接入真实 LLM 后，先只 dry-run：

```bash
python3 scripts/daily_pipeline_email.py --skip-pipeline --dry-run
```

确认 LLM 摘要和 SMTP 正常后，再跑完整链路。注意：完整链路会先用 `/ops` 同源提示词调用 LLM 生成 `data/hotspots/`，再调用 LLM 回答 match/generate，并写入 `data/runs/` 与 `data/today/`：

```bash
python3 scripts/daily_pipeline_email.py --accounts acct-xiaozhu-edu-xhs --email-to cathy.hu.eng@gmail.com
```

限制账号：

```bash
python3 scripts/daily_pipeline_email.py --accounts acct-xiaozhu-edu-xhs,acct-razor-douyin-boss --email-to cathy.hu.eng@gmail.com
```

## crond 示例

推荐把环境变量放在服务器本地文件，例如 `/etc/yowow/cron-email.env`，文件权限设为只有部署用户可读。

```cron
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin

0 8 * * * cd /srv/yowow-adaptation && set -a && source /etc/yowow/cron-email.env && set +a && python3 scripts/daily_pipeline_email.py --email-to cathy.hu.eng@gmail.com >> logs/daily-pipeline-email.log 2>&1
```

注意：`logs/` 目录需要提前创建。

## 失败处理

- 缺 LLM key：脚本直接失败，不伪造摘要。
- 缺 SMTP 配置：脚本直接失败，不吞错误。
- 热点池生成失败：脚本直接失败，不进入 match/generate。优先检查 LLM key、模型、提示词 JSON 输出；临时回退可先手工补 `data/hotspots/YYYY-MM-DD.json` 或 `data/hotspots/tracks/<track_id>/YYYY-MM-DD.json`，再加 `--skip-hotspot-generation` 跑后续链路。
- 某账号缺 `latest.json`：邮件里会提示“今天还没有 latest.json”，不会阻断其他账号。
- LLM 输出不是 JSON：脚本失败，避免把不可控内容发出去。
