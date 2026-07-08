# test/ 目录说明

这里是 Node test 回归测试。运行：

```bash
npm run test
```

浏览器级前端交互验收运行：

```bash
npm run test:e2e
```

## 测试分组

| 文件 | 覆盖点 |
|---|---|
| `global-gate-parity.test.mjs` | 全局禁词/内部词单一来源一致性 |
| `golden-adaptation.test.mjs` | golden 推荐判断稳定性 |
| `mvp-internal-loop.test.mjs` | internal MVP 允许本地跑通但保留 review 标记 |
| `onboarding-questionnaire.test.mjs` | 问卷能生成可运行账号/赛道 JSON |
| `p0-maintainable.test.mjs` | 维护性和关键红线 |
| `pr6-state.test.mjs` | 在线/本地状态文案与动作 |
| `pr7-performance.test.mjs` | 性能日志和数据批读 |
| `razor-latest-read.test.mjs` | razor latest 读取和 review 状态 |
| `status-preflight.test.mjs` | preflight/full status 语义 |

## E2E 测试

| 文件 | 覆盖点 |
|---|---|
| `e2e/frontend-interactions.spec.js` | 当前真实页面的导航、问卷复制、复制失败、删除取消、反馈保存、灵感读取失败 |

## 什么时候至少跑

- 改 `lib/`、`app/`、`scripts/`：跑 `npm run test` + `npm run typecheck`。
- 改前端按钮、页面交互、反馈/复制/删除/灵感入口：再跑 `npm run test:e2e`。
- 改 prompts 或 ingest 格式：再跑 `python3 scripts/make-prompt.py --selftest` 和 `python3 scripts/ingest.py --selftest`。
