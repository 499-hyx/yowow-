import { listDocs } from "@/lib/data-source";

export type TrackConfigSummary = {
  track_id: string;
  track_name?: string;
  product_value?: string;
  status: string;
  forbidden_terms: string[];
  external_vocab: string[];
  bridge_directions: string[];
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asDirectionArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return String(record.direction ?? record.title ?? record.name ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

export async function loadTrackSummaries(): Promise<TrackConfigSummary[]> {
  // B档定版：搜索方向已并入 tracks/<id>.json 的 bridge.search_directions，赛道文件是唯一来源
  const tracks = await listDocs<Record<string, any>>("track_config");
  return tracks.map(({ key, body: track }) => {
    const trackId = String(track.track_id ?? key);
    return {
      track_id: trackId,
      track_name: track.track_name,
      product_value: track.product_value ?? track?.buyer?.product_value,
      status: String(track.status ?? "draft"),
      forbidden_terms: asStringArray(track?.bridge?.forbidden_terms),
      external_vocab: asStringArray(track?.bridge?.external_vocab),
      bridge_directions: asDirectionArray(track?.bridge?.search_directions),
    };
  });
}
