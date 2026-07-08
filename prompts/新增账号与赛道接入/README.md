# 新增账号与赛道接入提示词

这一层只处理“第一次接入”的材料，不参与每日跑批主链路。

## 第一性原理

新增账号不是改前端，而是补齐一个可运行的账号事实源：

```text
老板/运营问卷
  -> 账号记忆 data/accounts/<account_id>.json
  -> 绑定 track_id / platform_id / positioning_id
  -> preflight 通过
  -> /ops 账号下拉出现
  -> match / generate / ingest
  -> 账号页看到今日内容
```

新增赛道不是新增账号的必选项。只有现有赛道无法复用时，才新增赛道：

```text
新赛道业务种子
  -> config/tracks/<track_id>.json
  -> prompts/赛道热点/<track_id>/热点搜索.md
  -> prompts/分析提示词/<track_id>/赛道分析.md
  -> data/accounts/<account_id>.json 绑定该 track_id
  -> preflight 通过
```

## 文件分工

| 文件 | 做什么 | 输出去哪里 |
|---|---|---|
| `新增账号与赛道JSON草稿.md` | 根据问卷起草账号 JSON；新赛道时附带赛道 JSON 草稿 | `data/accounts/<account_id>.json` / `config/tracks/<track_id>.json` |
| `新赛道桥梁母题.md` | 起草新赛道如何把热点自然接到产品价值 | `config/tracks/<track_id>.json` 的 `bridge` 和 `example_bridges` |
| `新赛道热点搜索方向.md` | 起草新赛道每天往外搜什么热点 | `config/tracks/<track_id>.json` 的 `daily_search_question` 和 `bridge.search_directions` |

## 中文化边界

可以中文化：

- 本目录、prompt 文件名、README。
- `display_name`、`track_name`、`platform_name`、`positioning_name`。

暂时不要中文化：

- `account_id`、`track_id`、`platform_id`、`positioning_id`。
- `data/accounts/<account_id>.json` 和 `config/tracks/<track_id>.json` 的文件名。
- `data/today/<account_id>/...`、`data/runs/<date>/<account_id>/...`、`data/hotspots/tracks/<track_id>/...` 的目录名。

这些 ID 已经是脚本参数、URL 参数、数据目录键和测试夹具。直接改成中文会造成全链路迁移，而不是普通改名。

## 接入后必须验

```bash
python3 scripts/status.py --date <date> --preflight <account_id>
python3 scripts/make-prompt.py <account_id> --date <date> --step match --no-print
```
