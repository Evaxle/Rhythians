import { unzipSync, zipSync } from "fflate";

const RHYTHIANS_ID = "RhythiansId";

export function extensionFromMapUrl(url: string) {
  try {
    const match = new URL(url).pathname.match(/\.[a-z0-9]{2,8}$/i);
    return match?.[0]?.toLowerCase() ?? ".sspm";
  } catch {
    return ".sspm";
  }
}

export function embedRhythiansId(data: Uint8Array, extension: string, mapId: string) {
  if (extension === ".rhm") return embedRhm(data, mapId);
  return data;
}

function embedRhm(data: Uint8Array, mapId: string) {
  const files = unzipSync(data);
  const mapEntry = files.map ?? files.Map;
  if (!mapEntry) throw new Error("RHM map entry is missing.");
  const parsed = JSON.parse(new TextDecoder().decode(mapEntry)) as Record<string, unknown>;
  parsed[RHYTHIANS_ID] = mapId;
  files.map = new TextEncoder().encode(JSON.stringify(parsed));
  if (files.Map) delete files.Map;
  return zipSync(files, { level: 0 });
}

export function isSupportedMapExtension(extension: string) {
  return extension === ".rhm" || extension === ".sspm";
}
