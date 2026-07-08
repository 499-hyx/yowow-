"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { AccountMemory } from "@/lib/adaptation-types";
import { scanInternal } from "@/lib/adaptation-types";
import { memoryCompleteness } from "@/lib/memory-meta";

type FieldKind = "text" | "list";

type FieldConfig = {
  key: keyof AccountMemory;
  label: string;
  hint: string;
  kind: FieldKind;
};

type SectionConfig = {
  key: string;
  title: string;
  fields: FieldConfig[];
};

const SECTIONS: SectionConfig[] = [
  {
    key: "business",
    title: "业务事实",
    fields: [
      { key: "business", label: "卖什么", hint: "你主要卖什么产品或服务？", kind: "text" },
      { key: "audience", label: "卖给谁", hint: "谁会买它？", kind: "text" },
      { key: "product_value", label: "产品价值", hint: "你的东西最大的好，用一句话怎么说？", kind: "text" },
    ],
  },
  {
    key: "customer",
    title: "客户与证据",
    fields: [
      { key: "anxiety_anchors", label: "客户焦虑", hint: "客户最怕什么、最在意什么？", kind: "list" },
      { key: "proof_assets", label: "信任证据", hint: "你能拿出什么让人信你？", kind: "list" },
      { key: "commercial_goal", label: "商业目标", hint: "你发内容最想达成什么？", kind: "list" },
    ],
  },
  {
    key: "voice",
    title: "表达边界",
    fields: [
      { key: "content_style", label: "内容风格", hint: "直给、温和、专家感、老板感等。", kind: "text" },
      { key: "extra_external_vocab", label: "常用说法", hint: "你希望文案多用哪些人话表达？", kind: "list" },
      { key: "extra_forbidden_terms", label: "不能说的词", hint: "绝不想在文案里出现的词。", kind: "list" },
      { key: "banned_topics", label: "不能碰的话题", hint: "绝不想蹭的话题。", kind: "list" },
    ],
  },
];

type DraftMemory = Record<string, string | string[] | undefined>;

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function scanDraft(draft: DraftMemory): string[] {
  const values = Object.values(draft).flatMap((value) => (Array.isArray(value) ? value : [value]));
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string").flatMap((value) => scanInternal(value))));
}

function buildSectionDraft(memory: AccountMemory, section: SectionConfig): DraftMemory {
  const draft: DraftMemory = {};
  for (const field of section.fields) {
    draft[field.key] = field.kind === "list" ? asList(memory[field.key]) : stringValue(memory[field.key]);
  }
  return draft;
}

function ChipInput({
  values,
  onChange,
  disabled,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  function addChip() {
    const value = draft.trim();
    if (!value) return;
    onChange(Array.from(new Set([...values, value])));
    setDraft("");
  }
  return (
    <div className="rounded-md border border-[#D8D3CB] bg-white p-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1 rounded-full bg-[#F0EDE5] px-2 py-1 text-xs text-[#4A4A47]">
            {value}
            {!disabled ? (
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                className="text-[#8A877F] hover:text-[#1F1F1E]"
                aria-label={`删除 ${value}`}
              >
                x
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {!disabled ? (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addChip();
            }
          }}
          onBlur={addChip}
          className="mt-2 w-full bg-transparent text-sm outline-none"
          placeholder="输入后回车添加"
        />
      ) : null}
    </div>
  );
}

export default function MemoryEditor({
  accountId,
  initialMemory,
  readOnly = false,
  readOnlyMessage,
}: {
  accountId: string;
  initialMemory: AccountMemory;
  readOnly?: boolean;
  readOnlyMessage?: string;
}) {
  const router = useRouter();
  const [memory, setMemory] = useState<AccountMemory>(initialMemory);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftMemory>({});
  const [message, setMessage] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const completeness = useMemo(() => memoryCompleteness(memory), [memory]);

  function startEdit(section: SectionConfig) {
    setEditing(section.key);
    setDraft(buildSectionDraft(memory, section));
    setMessage("");
  }

  async function save(section: SectionConfig) {
    const hits = scanDraft(draft);
    if (hits.length) {
      setMessage("这张卡里有不能写入账号记忆的词，请删掉后再保存。");
      return;
    }
    setSaving(true);
    setMessage("");
    const memoryPatch = section.fields.reduce<Partial<AccountMemory>>((acc, field) => {
      (acc as Record<string, unknown>)[field.key] = draft[field.key];
      return acc;
    }, {});
    try {
      const res = await fetch(`/api/accounts/${accountId}/memory`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memory: memoryPatch }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; hits?: string[]; memory_updated_at?: string };
      if (!body.ok) {
        setMessage(body.error ?? "保存失败。");
        return;
      }
      setMemory((prev) => ({ ...prev, ...memoryPatch }));
      setEditing(null);
      setMessage("已保存，下次跑批生效。");
      router.refresh();
    } catch {
      setMessage("网络不太顺，稍后再试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {readOnly ? (
        <div className="rounded-lg border border-[#E0D9CE] bg-[#F8F4EE] px-4 py-3 text-sm text-[#6B6963]">
          {readOnlyMessage ?? "线上当前只能查看账号定位。要修改，请编辑本地 data/accounts/<account_id>.json；下次跑批生效。"}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E8E6E1] bg-white px-4 py-3">
        <div className="h-2 w-40 overflow-hidden rounded bg-[#F0EDE5]">
          <div className="h-2 rounded bg-[#5C7A2E]" style={{ width: `${completeness.percent}%` }} />
        </div>
        <span className="text-sm text-[#4A4A47]">记忆完整度 {completeness.filled}/{completeness.total}</span>
        {message ? <span className="text-sm text-[#755019]">{message}</span> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {SECTIONS.map((section) => {
          const isEditing = editing === section.key;
          const sectionDraft = isEditing ? draft : buildSectionDraft(memory, section);
          return (
            <section key={section.key} className="rounded-lg border border-[#D8D3CB] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-[#1F1F1E]">{section.title}</h3>
                {!readOnly ? (
                  isEditing ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => save(section)}
                        disabled={saving}
                        className="rounded-md bg-[#1F1F1E] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {saving ? "保存中" : "保存"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded-md border border-[#D8D3CB] px-3 py-1.5 text-xs text-[#343330]"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(section)}
                      className="rounded-md border border-[#D8D3CB] px-3 py-1.5 text-xs text-[#343330] hover:bg-[#F3F1EC]"
                    >
                      编辑
                    </button>
                  )
                ) : null}
              </div>

              <div className="mt-4 space-y-4">
                {section.fields.map((field) => {
                  const value = sectionDraft[field.key];
                  return (
                    <label key={String(field.key)} className="block">
                      <span className="text-xs font-medium text-[#8A877F]">{field.label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[#9B9892]">{field.hint}</span>
                      {field.kind === "list" ? (
                        <div className="mt-2">
                          <ChipInput
                            values={asList(value)}
                            disabled={!isEditing}
                            onChange={(next) => setDraft((prev) => ({ ...prev, [field.key]: next }))}
                          />
                        </div>
                      ) : isEditing ? (
                        <textarea
                          value={stringValue(value)}
                          onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                          className="mt-2 min-h-24 w-full rounded-md border border-[#D8D3CB] bg-white p-2 text-sm leading-relaxed outline-none focus:border-[#5C7A2E]"
                        />
                      ) : (
                        <p className="mt-2 rounded-md bg-[#FBFAF7] p-2 text-sm leading-relaxed text-[#4A4A47]">
                          {stringValue(value) || "未填"}
                        </p>
                      )}
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
