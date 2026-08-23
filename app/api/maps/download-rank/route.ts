import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getRankInfo } from "@/lib/ranks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeName(value: string) { return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "map"; }
function extensionFromUrl(url: string) { try { return new URL(url).pathname.match(/(\.[a-z0-9]{2,8})$/i)?.[1] ?? ".sspm"; } catch { return ".sspm"; } }
const crcTable = (() => { const table = new Uint32Array(256); for (let i = 0; i < 256; i += 1) { let value = i; for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; table[i] = value >>> 0; } return table; })();
function crc32(data: Uint8Array) { let crc = 0xffffffff; for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function u16(value: number) { const buffer = Buffer.allocUnsafe(2); buffer.writeUInt16LE(value & 0xffff, 0); return buffer; }
function u32(value: number) { const buffer = Buffer.allocUnsafe(4); buffer.writeUInt32LE(value >>> 0, 0); return buffer; }
function dosTimeAndDate(date = new Date()) { const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2); const year = Math.max(1980, date.getFullYear()); const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(); return { time, day }; }
function localRecord(name: string, data: Buffer, time: number, day: number, checksum: number) { const nameBuffer = Buffer.from(name, "utf8"); return Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(day), u32(checksum), u32(data.length), u32(data.length), u16(nameBuffer.length), u16(0), nameBuffer, data]); }
function centralRecord(name: string, data: Buffer, time: number, day: number, checksum: number, offset: number) { const nameBuffer = Buffer.from(name, "utf8"); return Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(day), u32(checksum), u32(data.length), u32(data.length), u16(nameBuffer.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBuffer]); }
function endRecord(count: number, centralSize: number, localSize: number) { return Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(count), u16(count), u32(centralSize), u32(localSize), u16(0)]); }
function frame(type: number, data: Uint8Array) { const header = Buffer.allocUnsafe(5); header.writeUInt8(type, 0); header.writeUInt32BE(data.length, 1); return Buffer.concat([header, Buffer.from(data)]); }
async function fetchMap(url: string, referer: string) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15_000); try { const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: controller.signal, headers: { accept: "application/octet-stream,application/x-sspm,*/*", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36", referer } }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const contentType = response.headers.get("content-type") ?? ""; if (contentType.includes("text/html")) throw new Error("Rhythia returned an HTML page instead of an SSPM file"); const data = Buffer.from(await response.arrayBuffer()); if (data.length < 4) throw new Error("Downloaded file was empty"); return data; } finally { clearTimeout(timer); } }
async function buildDownloadStream(maps: Array<{ id: string; title: string; mapFileUrl: string }>, withProgress: boolean) {
  const { time, day } = dosTimeAndDate(); let offset = 0; let downloaded = 0; let processed = 0; const central: Buffer[] = []; const failures: string[] = [];
  return new ReadableStream<Uint8Array>({ start(controller) { void (async () => { const sendProgress = () => { if (withProgress) controller.enqueue(frame(1, Buffer.from(JSON.stringify({ downloaded, processed, total: maps.length }), "utf8"))); }; sendProgress(); for (const map of maps) { try { const data = await fetchMap(map.mapFileUrl, `https://www.rhythia.com/maps/${map.id}`); downloaded += 1; const name = `${String(downloaded).padStart(3, "0")} - ${safeName(map.title)}${extensionFromUrl(map.mapFileUrl)}`; const checksum = crc32(data); const local = localRecord(name, data, time, day, checksum); central.push(centralRecord(name, data, time, day, checksum, offset)); if (withProgress) controller.enqueue(frame(2, local)); else controller.enqueue(local); offset += local.length; } catch (error) { failures.push(`${map.title}: ${error instanceof Error ? error.message : "download failed"}`); } processed += 1; sendProgress(); } if (failures.length > 0) { const data = Buffer.from(`${failures.join("\n")}\n`, "utf8"); const name = "download-errors.txt"; const checksum = crc32(data); const local = localRecord(name, data, time, day, checksum); central.push(centralRecord(name, data, time, day, checksum, offset)); if (withProgress) controller.enqueue(frame(2, local)); else controller.enqueue(local); offset += local.length; } const centralData = Buffer.concat(central); const end = endRecord(central.length, centralData.length, offset); if (withProgress) { controller.enqueue(frame(2, centralData)); controller.enqueue(frame(2, end)); } else { controller.enqueue(centralData); controller.enqueue(end); } controller.close(); })().catch((error) => { if (withProgress) controller.enqueue(frame(3, Buffer.from(JSON.stringify({ message: error instanceof Error ? error.message : "Could not build the ZIP." }), "utf8"))); controller.close(); }); } });
}

export async function GET(request: Request) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const params = new URL(request.url).searchParams; const mode = params.get("mode") ?? "ranked"; const withProgress = params.get("progress") === "1";
  if (!["ranked", "ranked-legacy", "legacy"].includes(mode)) return NextResponse.json({ error: "Invalid download mode." }, { status: 400 });
  const rankInfo = getRankInfo(user.rhp); const status = mode === "legacy" ? "legacy" : mode === "ranked-legacy" ? { in: ["approved", "legacy"] as const } : "approved";
  const maps = await prisma.challengeMap.findMany({ where: { status, rating: { not: null, gte: rankInfo.rangeMin, lte: rankInfo.rangeMax } }, select: { id: true, title: true, mapFileUrl: true }, orderBy: [{ rating: "asc" }, { createdAt: "desc" }] });
  if (maps.length === 0) return NextResponse.json({ error: `No ${mode === "legacy" ? "legacy" : "ranked"} maps are available for your current rank.` }, { status: 404 });
  const stream = await buildDownloadStream(maps, withProgress); const rankName = rankInfo.isExpert ? "Expert" : rankInfo.name; const suffix = mode === "legacy" ? "legacy" : mode === "ranked-legacy" ? "ranked-plus-legacy" : "ranked";
  if (withProgress) return new Response(stream, { headers: { "Content-Type": "application/x-rhythians-map-download", "Cache-Control": "no-store", "X-Map-Total": String(maps.length) } });
  return new Response(stream, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${safeName(`${rankName}-${suffix}-maps`)}.zip"`, "Cache-Control": "no-store" } });
}
