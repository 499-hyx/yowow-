# Archived `lib/server-data.ts` Preview Helpers

> 归档说明：2026-06-29 清理活代码时，从 `lib/server-data.ts` 移除了未被运行路径引用的 warm-start / preview helper。当前 `lib/server-data.ts` 只负责 `/api/options` 的配置选项装配。

## 移出的历史函数

- `platformNameOf`
- `searchDirectionsOf`
- `buildEffectiveTrack`
- `loadDemoHotspots`
- `buildMeta`
- `gateVisible`
- `loadWarmBoard`
- `rankScore`
- `toBoard`

## 为什么移出

当前 MVP 主链路是：

```text
data/hotspots + data/accounts + config/tracks
  -> scripts/make-prompt.py
  -> 外部 LLM / agent / 人工回贴
  -> scripts/ingest.py
  -> data/today/<account_id>/latest.json
  -> app/api/today/route.ts
```

这些 helper 属于早期 warm-start / 在线预览装配层，容易让接手人误以为前端或 API 会生成 today 结果。正式今日结果只能由 `scripts/ingest.py` 安装。

## 如果未来要恢复

不要直接把这些 helper 放回主链路。先开独立工单，说明：

- 是否要恢复在线生成或 warm-start 预览。
- 如何保证 API 不绕过 `scripts/ingest.py` 写 `data/today/`。
- 如何复用 Python ingest 的禁词、内部术语和 bridge_paths 校验。
- 如何通过 `npm run typecheck`、`npm run test`、`python3 scripts/ingest.py --selftest` 和 `python3 adaptation-core/verify.py`。
