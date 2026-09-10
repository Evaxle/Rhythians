import { rhythiaRequest } from "@/lib/rhythia";

export type ResolvedRhythiaMapSource = {
  id: number;
  title: string | null;
  mapFileUrl: string | null;
  imageUrl: string | null;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
};

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
function absoluteUrl(value: string | null, base = "https://www.rhythia.com") {
  if (!value) return null;
  const cleaned = value.replace(/\\u0026/g, "&").replace(/\\\//g, "/").replace(/&amp;/g, "&").trim();
  try { return new URL(cleaned, base).toString(); } catch { return null; }
}
function deepRecords(value: unknown, depth = 0): Record<string, unknown>[] {
  if (!value || typeof value !== "object" || depth > 4) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => deepRecords(entry, depth + 1));
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap((entry) => deepRecords(entry, depth + 1))];
}
function stringField(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) for (const key of keys) if (typeof record[key] === "string" && (record[key] as string).trim()) return record[key] as string;
  return null;
}
function numericField(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) for (const key of keys) { const value = numberValue(record[key]); if (value != null) return value; }
  return null;
}
function exactMapFromResponse(value: unknown, id: number) {
  const records = deepRecords(value);
  return records.find((record) => numberValue(record.id ?? record.mapId ?? record.beatmapId) === id) ?? null;
}
async function apiDetail(id: number) {
  const attempts = [
    { textFilter: String(id), page: 1, session: "" },
    { id, page: 1, session: "" },
    { beatmapId: id, page: 1, session: "" },
  ];
  for (const body of attempts) {
    try {
      const data = await rhythiaRequest<unknown>("getBeatmaps", body);
      const exact = exactMapFromResponse(data, id);
      if (exact) return exact;
    } catch {}
  }
  return null;
}
function htmlMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"));
  return a?.[1] ?? b?.[1] ?? null;
}
function htmlJsonString(html: string, keys: string[]) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = html.match(new RegExp(`["']${escaped}["']\\s*:\\s*["']([^"']+)["']`, "i"));
    if (match?.[1]) return match[1];
  }
  return null;
}
async function pageAssets(id: number) {
  const pageUrl = `https://www.rhythia.com/maps/${id}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(pageUrl, { cache: "no-store", redirect: "follow", signal: controller.signal, headers: { accept: "text/html", "user-agent": "Rhythians-MapAnalyzer/3.0" } });
    if (!response.ok) return { imageUrl: null, mapFileUrl: null };
    const html = await response.text();
    const image = htmlMeta(html, "og:image") ?? htmlMeta(html, "twitter:image") ?? htmlJsonString(html, ["imageUrl", "image", "coverUrl", "cover", "thumbnailUrl"]);
    const direct = htmlJsonString(html, ["beatmapFile", "beatmap_file", "downloadUrl", "download_url", "mapFileUrl", "fileUrl"])
      ?? html.match(/https?:\\?\/\\?\/[^"'<>\s]+\.(?:sspm|rhm)(?:\?[^"'<>\s]*)?/i)?.[0]
      ?? null;
    return { imageUrl: absoluteUrl(image, pageUrl), mapFileUrl: absoluteUrl(direct, pageUrl) };
  } catch {
    return { imageUrl: null, mapFileUrl: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveRhythiaMapSource(id: number): Promise<ResolvedRhythiaMapSource> {
  const detail = await apiDetail(id);
  const records = detail ? deepRecords(detail) : [];
  const page = await pageAssets(id);
  const title = stringField(records, ["title", "name", "beatmapTitle"]);
  const file = stringField(records, ["beatmapFile", "beatmap_file", "downloadUrl", "download_url", "mapFileUrl", "map_file_url", "fileUrl", "file_url", "file"]);
  const image = stringField(records, ["image", "imageUrl", "image_url", "cover", "coverUrl", "cover_url", "preview", "previewUrl", "preview_url", "thumbnail", "thumbnailUrl", "thumbnail_url"]);
  const mapperName = stringField(records, ["ownerUsername", "owner_username", "mapperName", "mapper_name", "authorUsername", "author", "mapper"]);
  return {
    id,
    title,
    mapFileUrl: absoluteUrl(file, "https://production.rhythia.com") ?? page.mapFileUrl,
    imageUrl: absoluteUrl(image, "https://production.rhythia.com") ?? page.imageUrl,
    mapperName,
    noteCount: numericField(records, ["noteCount", "note_count", "notes", "beatmapNotes"]),
    length: numericField(records, ["length", "duration", "durationMs", "duration_ms"]),
  };
}
