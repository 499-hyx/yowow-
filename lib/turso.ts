// turso.ts — 极简 Turso HTTP 客户端（零依赖，fetch 版）。
//
// 只在设置了 TURSO_DATABASE_URL + TURSO_AUTH_TOKEN 时启用；
// 没设置时 data-source.ts 自动回落读本地文件（本地开发零配置）。

export function tursoEnabled(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

type Row = Record<string, string | null>;

export async function tursoQuery(sql: string, args: (string | number)[] = []): Promise<Row[]> {
  const url = (process.env.TURSO_DATABASE_URL ?? "").replace("libsql://", "https://").replace(/\/$/, "");
  const res = await fetch(`${url}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql, args: args.map((a) => ({ type: "text", value: String(a) })) } },
        { type: "close" },
      ],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Turso HTTP ${res.status}`);
  const data = await res.json();
  const first = data?.results?.[0];
  if (first?.type === "error") throw new Error(`Turso: ${JSON.stringify(first.error)}`);
  const result = first?.response?.result;
  const cols: string[] = (result?.cols ?? []).map((c: { name: string }) => c.name);
  return (result?.rows ?? []).map((cells: { value: string | null }[]) => {
    const row: Row = {};
    cells.forEach((cell, i) => (row[cols[i]] = cell?.value ?? null));
    return row;
  });
}

export async function tursoExecute(sql: string, args: (string | number)[] = []): Promise<void> {
  await tursoQuery(sql, args);
}
