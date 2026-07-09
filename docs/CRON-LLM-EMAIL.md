# Cron LLM Email

目标：先用 Linux `crond` 跑一个独立任务，完成每日链路并邮件通知：

```text
检查手动热点池 → 生成 match 提示词 → LLM 回答 match → 生成 generate 提示词
→ LLM 回答 generate → ingest 安装 → latest.json 前端数据检查 → 邮件摘要
→ 可选：提交并推送到 GitHub
→ 可选：同步 Turso
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

LLM 超时与重试：

```bash
export LLM_TIMEOUT_SECONDS=120       # 单次请求超时
export LLM_RETRY_ATTEMPTS=2          # 总尝试次数
export LLM_RETRY_BASE_SECONDS=3      # 第一次失败后的等待秒数，之后指数退避
export LLM_RETRY_MAX_SECONDS=20      # 单次等待上限
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

确认手动热点池、LLM 摘要和 SMTP 正常后，再跑完整链路。注意：默认链路不会调用 LLM 生成热点池；它会读取已有 `data/hotspots/`，再调用 LLM 回答 match/generate，并写入 `data/runs/` 与 `data/today/`：

```bash
python3 scripts/daily_pipeline_email.py --accounts acct-xiaozhu-edu-xhs --email-to cathy.hu.eng@gmail.com
```

如需临时让脚本自动生成热点池，必须显式加 `--generate-hotspots`。日常 crond 不建议使用该参数。

如果部署站点是 GitHub 推送触发 Vercel 构建，可以在邮件发送成功后自动提交并推送本次可上线文件：

```bash
python3 scripts/daily_pipeline_email.py --accounts acct-xiaozhu-edu-xhs --email-to cathy.hu.eng@gmail.com --commit-to-github
```

`--commit-to-github` 只暂存这些发布相关文件：

- `data/hotspots/<date>.json`
- `data/hotspots/tracks/<track_id>/<date>.json`
- `data/today/<account_id>/`
- `data/accounts/<account_id>.json`
- `config/tracks/<track_id>.json`
- `prompts/赛道热点/<track_id>/`
- `prompts/分析提示词/<track_id>/`

它不会提交 `data/runs/`、日志或审计材料。若执行前已经有 staged changes，脚本会拒绝自动提交，避免把人工改动混进 crond 提交。

注意：如果线上 Vercel 配了 `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`，网站优先读 Turso docs 表；这种模式下 GitHub push 只会触发部署，不会更新线上数据。要让线上出现新跑批结果，还需要在负责人授权后执行 `--sync-to-db` 或单独运行 `python3 scripts/sync-to-db.py`。

两个开关同时使用时，顺序固定为：先发邮件，再 commit/push GitHub，最后 `sync-to-db`。这适合“GitHub 触发部署 + Turso 作为线上数据源”的生产链路：

```bash
python3 scripts/daily_pipeline_email.py --accounts acct-xiaozhu-edu-xhs --email-to cathy.hu.eng@gmail.com --commit-to-github --sync-to-db
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

GitHub 文件部署模式可写成：

```cron
0 8 * * * cd /srv/yowow-adaptation && set -a && source /etc/yowow/cron-email.env && set +a && python3 scripts/daily_pipeline_email.py --email-to cathy.hu.eng@gmail.com --commit-to-github >> logs/daily-pipeline-email.log 2>&1
```

Turso 镜像模式不要只依赖 GitHub push；应在明确授权后使用。若也希望 GitHub 触发部署，就两个开关一起开：

```cron
0 8 * * * cd /srv/yowow-adaptation && set -a && source /etc/yowow/cron-email.env && set +a && python3 scripts/daily_pipeline_email.py --email-to cathy.hu.eng@gmail.com --commit-to-github --sync-to-db >> logs/daily-pipeline-email.log 2>&1
```

注意：`logs/` 目录需要提前创建。

## 失败处理

- 缺 LLM key：脚本直接失败，不伪造摘要。
- 缺 SMTP 配置：脚本直接失败，不吞错误。
- 缺当天热点池：脚本直接失败，不进入 match/generate。先手工补 `data/hotspots/YYYY-MM-DD.json` 或 `data/hotspots/tracks/<track_id>/YYYY-MM-DD.json`。
- LLM 请求超时或 429/5xx：脚本会打印 provider/model/endpoint/attempt/timeout/耗时，按 `LLM_RETRY_ATTEMPTS` 自动重试；最终仍失败才退出。
- 某账号缺 `latest.json`：邮件里会提示“今天还没有 latest.json”，不会阻断其他账号。
- LLM 输出不是 JSON：脚本失败，避免把不可控内容发出去。
- Git 自动提交前已有 staged changes：脚本失败，避免混合提交。
- Git push 成功但线上没变：先确认 Vercel 是否触发了新部署；若线上配置了 Turso，则还要同步 Turso。
