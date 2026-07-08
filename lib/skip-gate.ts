// ⚠️ 预览专用 / 非线上 today 闸门（2026-06-24 标注）。
//    线上唯一的跳过/禁词闸门是 Python：scripts/ingest.py 的 gate_visible / validate_adaptation_output。
//    本文件 evaluateSkipGate 只被 lib/server-data.ts（warm-start 预览）与测试调用——改它【不改变线上跑批行为】。
//    内部术语清单已与 config/global-gate.json 对齐（test/global-gate-parity.test.mjs 守护）。
//    注：forced-hints 已在 Python ingest 对齐（2026-06-24，同源 config/global-gate.json）；
//    仅剩 platform-mismatch 仅 TS 有——但线上每账号单平台、该场景不会发生，故 ingest 无需补。

export type SkipGateCode =
  | "already_skip"
  | "missing_natural_paths"
  | "forced_emotion_only"
  | "track_forbidden_term"
  | "account_forbidden_term"
  | "platform_mismatch"
  | "missing_publishable_angle"
  | "internal_term_visible";

export type SkipGateResult = {
  skip: boolean;
  code?: SkipGateCode;
  reason?: string;
  hits?: string[];
};

export type SkipGateOptions = {
  trackForbiddenTerms?: string[];
  accountForbiddenTerms?: string[];
  platformId?: string;
  supportedPlatformIds?: string[];
};

type BridgePathLike = {
  phenomenon?: string;
  real_problem?: string;
  track_relation?: string;
  product_value_support?: string;
  platform_expression?: string;
};

type OutputLike = {
  recommendation?: string;
  bridge_paths?: BridgePathLike[];
  content?: {
    topic?: string;
    title?: string;
    body_or_script?: string;
  } | null;
  skip_reason?: string | null;
};

const INTERNAL_OR_SCORE = [
  "远迁移",
  "far transfer",
  "OOD",
  "in-distribution",
  "范式转移",
  "relevance",
  "naturalness",
  "相关度分",
  "自然度分",
];

const FORCED_CONNECTION_HINTS = [
  "硬蹭",
  "硬扯",
  "强蹭",
  "强行",
  "绕很远",
  "情绪硬蹭",
  "生蹭",
];

function includesTerm(text: string, term: string): boolean {
  if (!term) return false;
  return /^[\x00-\x7F]+$/.test(term)
    ? text.toLowerCase().includes(term.toLowerCase())
    : text.includes(term);
}

export function scanInternalTerms(text: string): string[] {
  return INTERNAL_OR_SCORE.filter((term) => includesTerm(text, term));
}

function visibleStrings(output: OutputLike): string[] {
  const out: string[] = [];
  for (const path of output.bridge_paths ?? []) {
    out.push(
      path.phenomenon ?? "",
      path.real_problem ?? "",
      path.track_relation ?? "",
      path.product_value_support ?? "",
      path.platform_expression ?? "",
    );
  }
  if (output.content) {
    out.push(output.content.topic ?? "", output.content.title ?? "", output.content.body_or_script ?? "");
  }
  if (output.skip_reason) out.push(output.skip_reason);
  return out.filter(Boolean);
}

function hasFiveStepPath(path: BridgePathLike): boolean {
  return Boolean(
    path.phenomenon &&
      path.real_problem &&
      path.track_relation &&
      path.product_value_support &&
      path.platform_expression,
  );
}

function findVisibleHits(output: OutputLike, terms: string[]): string[] {
  const strings = visibleStrings(output);
  const hits = new Set<string>();
  for (const text of strings) {
    for (const term of terms) {
      if (includesTerm(text, term)) hits.add(term);
    }
  }
  return Array.from(hits);
}

export function evaluateSkipGate(output: OutputLike, options: SkipGateOptions = {}): SkipGateResult {
  if (output.recommendation === "skip") {
    return { skip: false, code: "already_skip" };
  }

  if (
    options.platformId &&
    options.supportedPlatformIds?.length &&
    !options.supportedPlatformIds.includes(options.platformId)
  ) {
    return {
      skip: true,
      code: "platform_mismatch",
      reason: "这个平台不适合这条内容形态，先跳过。",
    };
  }

  const paths = output.bridge_paths ?? [];
  if (paths.length < 3 || paths.some((path) => !hasFiveStepPath(path))) {
    return {
      skip: true,
      code: "missing_natural_paths",
      reason: "自然连接路径不够完整，硬发会像蹭热点。",
    };
  }

  if (!output.content?.topic || !output.content?.title || !output.content?.body_or_script) {
    return {
      skip: true,
      code: "missing_publishable_angle",
      reason: "没有形成自然可发布角度，先跳过。",
    };
  }

  const forcedHits = findVisibleHits(output, FORCED_CONNECTION_HINTS);
  if (forcedHits.length) {
    return {
      skip: true,
      code: "forced_emotion_only",
      reason: "连接方式像情绪硬蹭，先跳过。",
      hits: forcedHits,
    };
  }

  const internalHits = findVisibleHits(output, INTERNAL_OR_SCORE);
  if (internalHits.length) {
    return {
      skip: true,
      code: "internal_term_visible",
      reason: "用户可见内容可能暴露内部分析术语，先跳过。",
      hits: internalHits,
    };
  }

  const trackHits = findVisibleHits(output, options.trackForbiddenTerms ?? []);
  if (trackHits.length) {
    return {
      skip: true,
      code: "track_forbidden_term",
      reason: "用户可见内容命中赛道禁词，先跳过。",
      hits: trackHits,
    };
  }

  const accountHits = findVisibleHits(output, options.accountForbiddenTerms ?? []);
  if (accountHits.length) {
    return {
      skip: true,
      code: "account_forbidden_term",
      reason: "用户可见内容命中账号禁区，先跳过。",
      hits: accountHits,
    };
  }

  return { skip: false };
}

export function forceSkipByGate<T extends OutputLike>(output: T, gate: SkipGateResult): T {
  if (!gate.skip) return output;
  return {
    ...output,
    recommendation: "skip",
    skip_reason: gate.reason ?? "这条没过自检，先不给你看。",
    bridge_paths: [],
    content: null,
  };
}
