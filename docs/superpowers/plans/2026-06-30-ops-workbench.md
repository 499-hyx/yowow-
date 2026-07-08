# Ops Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local `/ops` page for one-person daily operation: copy prompts, paste LLM JSON, save files to the existing run folders, and install results through `scripts/ingest.py`.

**Architecture:** Keep the existing file-driven pipeline. Add a small server helper for path validation, prompt rendering/reading, inbox writes, and script execution. The client page only calls local APIs and never writes `data/today` directly.

**Tech Stack:** Next.js App Router, React client component, Node filesystem APIs, existing Python scripts.

---

### Task 1: Server Helper And Tests

**Files:**
- Create: `lib/ops-workbench.ts`
- Create: `test/ops-workbench.test.mjs`

- [ ] Write tests for prompt rendering, inbox JSON splitting, hotspot pool validation, and ingest command boundary.
- [ ] Implement minimal helper functions with safe date/account/track/stage validation.

### Task 2: Local Ops APIs

**Files:**
- Create: `app/api/ops/status/route.ts`
- Create: `app/api/ops/hotspots/route.ts`
- Create: `app/api/ops/prompts/route.ts`
- Create: `app/api/ops/inbox/route.ts`
- Create: `app/api/ops/ingest/route.ts`

- [ ] Add APIs that call the helper.
- [ ] Return human-readable file paths and command output.
- [ ] Do not expose env vars or execute formal `sync-to-db.py`.

### Task 3: `/ops` Page

**Files:**
- Create: `components/adaptation/OpsWorkbench.tsx`
- Create: `app/ops/page.tsx`
- Modify: `app/page.tsx`

- [ ] Render date/account selectors.
- [ ] Provide copy buttons for broad/search hotspot prompts.
- [ ] Provide paste boxes for broad pool, track pool, match replies, and generate replies.
- [ ] Provide buttons for preflight, generate match prompts, generate generate prompts, save replies, ingest, and open result page.

### Task 4: Browser Test And Verification

**Files:**
- Modify: `e2e/frontend-interactions.spec.js`

- [ ] Test `/ops` loads.
- [ ] Mock APIs and verify every primary button shows visible success/failure feedback.
- [ ] Run `npm run test`, `npm run typecheck`, and `npm run test:e2e`.
