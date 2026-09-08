export type ClipSourceType = "upload" | "tiktok" | "youtube" | "twitch";

const PREFIX = "external:";

export function externalClipPath(platform: Exclude<ClipSourceType, "upload">, url: string) {
  return `${PREFIX}${platform}:${encodeURIComponent(url)}`;
}

export function externalThumbnailPath(url: string) {
  return `${PREFIX}image:${encodeURIComponent(url)}`;
}

export function parseExternalPath(path: string) {
  if (!path.startsWith(PREFIX)) return null;
  const rest = path.slice(PREFIX.length);
  const split = rest.indexOf(":");
  if (split < 1) return null;
  const type = rest.slice(0, split);
  const encoded = rest.slice(split + 1);
  try { return { type, url: decodeURIComponent(encoded) }; } catch { return null; }
}

export function youtubeVideoId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live"].includes(parts[0] ?? "")) return parts[1] ?? null;
    }
  } catch {}
  return null;
}

export function tiktokVideoId(value: string) {
  try {
    const url = new URL(value);
    if (!url.hostname.endsWith("tiktok.com")) return null;
    const match = url.pathname.match(/\/video\/(\d+)/);
    return match?.[1] ?? null;
  } catch { return null; }
}

export function twitchClipSlug(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "clips.twitch.tv") return url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (url.hostname.endsWith("twitch.tv")) {
      const match = url.pathname.match(/\/clip\/([^/?]+)/);
      return match?.[1] ?? null;
    }
  } catch {}
  return null;
}

export function validateExternalClipUrl(platform: Exclude<ClipSourceType, "upload">, value: string) {
  if (platform === "youtube") {
    const id = youtubeVideoId(value);
    if (!id) throw new Error("Enter a valid YouTube video, Shorts, or live-video URL.");
    return { url: `https://www.youtube.com/watch?v=${id}`, id, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  if (platform === "tiktok") {
    const id = tiktokVideoId(value);
    if (!id) throw new Error("Enter the full TikTok video URL containing /video/ followed by the video ID.");
    return { url: `https://www.tiktok.com/video/${id}`, id, thumbnailUrl: null };
  }
  const id = twitchClipSlug(value);
  if (!id) throw new Error("Enter a valid Twitch clip URL.");
  return { url: `https://clips.twitch.tv/${id}`, id, thumbnailUrl: null };
}
