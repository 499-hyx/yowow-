# data/accounts/ 账号事实源

这里每个 JSON 文件代表一个真实账号。文件名必须和 JSON 内的 `account_id` 一致：

```text
data/accounts/<account_id>.json
```

## 为什么文件名暂时不改中文

`account_id` 不是展示名，而是系统主键。它同时出现在：

- `scripts/status.py --preflight <account_id>`
- `scripts/make-prompt.py <account_id>`
- `scripts/ingest.py <account_id>`
- `/account/<account_id>`、`/card/<account_id>/<date>/<hotspot_id>`
- `data/runs/<date>/<account_id>/`
- `data/today/<account_id>/latest.json`
- Turso 同步键和测试夹具

所以这里不建议把文件名改成中文。中文展示名请写在 JSON 的 `display_name` 和 `track_name` 字段里。

## 新增账号最小步骤

```text
1. 打开 /onboarding，填问卷。
2. 复制账号 JSON。
3. 保存为 data/accounts/<account_id>.json。
4. 如果是新赛道，先补 config/tracks/<track_id>.json 和对应赛道提示词。
5. 跑 python3 scripts/status.py --date <date> --preflight <account_id>。
6. 刷新首页，账号会出现在工作台。
```

## 现有账号

| 文件 | 展示账号 | 绑定赛道 |
|---|---|---|
| `acct-razor-douyin-boss.json` | 剃须刀老板号 | `razor-personalcare` |
| `acct-xiaozhu-edu-xhs.json` | 小朱教育小红书号 | `education-yowow` |
