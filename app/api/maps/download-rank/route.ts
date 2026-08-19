import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getApprovedMaps } from "@/lib/maps-legacy";
import { getRankInfo } from "@/lib/ranks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "map";
}

function extensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/(\.[a-z0-9]{2,8})$/i);
    return match?.[1] ?? ".rhm";
  } catch {
    return ".rhm";
  }
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function u32(value: number) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function dosTimeAndDate(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const year = Math.max(1980, date.getFullYear());
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function buildZip(files: Array<{ name: string; data: Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { time, day } = dosTimeAndDate();

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const size = file.data.length;
    const checksum = crc32(file.data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(day),
      u32(checksum), u32(size), u32(size), u16(name.length), u16(0), name, file.data,
    ]);
    localParts.push(local);
    centralParts.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(day),
      u32(checksum), u32(size), u32(size), u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), name,
    ]));
    offset += local.length;
  }

  const local = Buffer.concat(localParts);
  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(local.length), u16(0),
  ]);
  return Buffer.concat([local, central, end]);
}

async function fetchMap(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const data = await getApprovedMaps(true, user.id);
  if (!data.rankInfo) return NextResponse.json({ error: "Unable to determine your rank." }, { status: 400 });

  const rankInfo = getRankInfo(user.rhp);
  const maps = data.maps.filter((map) => map.isAutoImported && map.rating != null && map.rating >= rankInfo.rangeMin && map.rating <= rankInfo.rangeMax);
  if (maps.length === 0) return NextResponse.json({ error: "No maps are available for your rank." }, { status: 404 });

  const files: Array<{ name: string; data: Buffer }> = [];
  const failures: string[] = [];
  const queue = [...maps];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(8, queue.length) }, async () => {
    while (queue.length > 0) {
      const map = queue.shift();
      if (!map) return;
      try {
        const fileData = await fetchMap(map.mapFileUrl);
        nextIndex += 1;
        files.push({ name: `${String(nextIndex).padStart(3, "0")} - ${safeName(map.title)}${extensionFromUrl(map.mapFileUrl)}`, data: fileData });
      } catch (error) {
        failures.push(`${map.title}: ${error instanceof Error ? error.message : "download failed"}`);
      }
    }
  });

  await Promise.all(workers);
  if (files.length === 0) return NextResponse.json({ error: "Unable to download any maps for your rank." }, { status: 502 });
  if (failures.length > 0) files.push({ name: "download-errors.txt", data: Buffer.from(`${failures.join("\n")}\n`, "utf8") });

  const zip = buildZip(files);
  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName(rankInfo.isExpert ? "Expert" : `${rankInfo.name} ${rankInfo.tier}`)}-maps.zip"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "no-store",
    },
  });
}
