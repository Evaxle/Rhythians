import "server-only";
import { validateExternalClipUrl, type ExternalClipSourceType } from "@/lib/clip-source";

export type ExternalVideoMetadata = {
  sourceType: ExternalClipSourceType;
  url: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
};

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function metaFromHtml(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

async function jsonOembed(url: string) {
  const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Rhythians/1.0" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("The video provider did not return metadata.");
  return response.json() as Promise<Record<string, unknown>>;
}

async function pageMetadata(url: string) {
  const response = await fetch(url, { cache: "no-store", redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 Rhythians/1.0" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("The video page could not be read.");
  const html = (await response.text()).slice(0, 1_500_000);
  return {
    title: metaFromHtml(html, "og:title") || metaFromHtml(html, "twitter:title"),
    description: metaFromHtml(html, "og:description") || metaFromHtml(html, "twitter:description") || metaFromHtml(html, "description"),
    thumbnailUrl: metaFromHtml(html, "og:image") || metaFromHtml(html, "twitter:image"),
  };
}

export async function resolveExternalVideoMetadata(sourceType: ExternalClipSourceType, value: string): Promise<ExternalVideoMetadata> {
  const validated = validateExternalClipUrl(sourceType, value);
  let title = "";
  let description = "";
  let thumbnailUrl = validated.thumbnailUrl;

  if (sourceType === "youtube") {
    const data = await jsonOembed(`https://www.youtube.com/oembed?url=${encodeURIComponent(validated.url)}&format=json`);
    title = clean(data.title, 120);
    description = clean(data.author_name ? `Video by ${data.author_name}` : "", 2000);
    thumbnailUrl = clean(data.thumbnail_url, 2000) || thumbnailUrl;
  } else if (sourceType === "tiktok") {
    const data = await jsonOembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(validated.url)}`);
    title = clean(data.title, 120);
    description = clean(data.author_name ? `TikTok by ${data.author_name}` : "", 2000);
    thumbnailUrl = clean(data.thumbnail_url, 2000) || null;
  } else {
    const data = await pageMetadata(validated.url);
    title = clean(data.title, 120);
    description = clean(data.description, 2000);
    thumbnailUrl = clean(data.thumbnailUrl, 2000) || null;
  }

  if (!title) title = sourceType === "medal" ? "Medal.tv clip" : sourceType === "twitch" ? "Twitch clip" : "Video clip";
  return { sourceType, url: validated.url, title, description, thumbnailUrl };
}
