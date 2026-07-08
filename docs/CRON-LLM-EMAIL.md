# Cron LLM Email

目标：先用 Linux `crond` 跑一个独立任务，读取本地 `data/today/*/latest.json`，调用 LLM 生成每日摘要，再通过 SMTP 发邮件。

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

## 本地验证

```bash
cd /path/to/yowow-adaptation
python3 scripts/cron_llm_email.py --selftest
python3 scripts/cron_llm_email.py --dry-run --no-llm
```

接入真实 LLM 后，先只 dry-run：

```bash
python3 scripts/cron_llm_email.py --dry-run
```

确认标题和正文正常后再发邮件：

```bash
python3 scripts/cron_llm_email.py
```

限制账号：

```bash
python3 scripts/cron_llm_email.py --accounts acct-xiaozhu-edu-xhs,acct-razor-douyin-boss
```

## crond 示例

推荐把环境变量放在服务器本地文件，例如 `/etc/yowow/cron-email.env`，文件权限设为只有部署用户可读。

```cron
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin

30 9 * * * cd /srv/yowow-adaptation && set -a && source /etc/yowow/cron-email.env && set +a && python3 scripts/cron_llm_email.py >> logs/cron-llm-email.log 2>&1
```

注意：`logs/` 目录需要提前创建。

## 失败处理

- 缺 LLM key：脚本直接失败，不伪造摘要。
- 缺 SMTP 配置：脚本直接失败，不吞错误。
- 某账号缺 `latest.json`：邮件里会提示“今天还没有 latest.json”，不会阻断其他账号。
- LLM 输出不是 JSON：脚本失败，避免把不可控内容发出去。
