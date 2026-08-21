import crypto from "node:crypto";
import { unzipSync } from "fflate";

const RHYTHIANS_ID = "RhythiansId";
const SSPM_FIELD = "rhythians_id_enc_v1";
const SSPM_KEY = Buffer.from("Jxr47SL1pmalG27ETO4hN8JR1VIHx4JfmgogLHM9t84=", "base64");

export function extensionFromMapUrl(url: string) {
  try {
    const match = new URL(url).pathname.match(/\.[a-z0-9]{2,8}$/i);
    return match?.[0]?.toLowerCase() ?? ".sspm";
  } catch {
    return ".sspm";
  }
}

export function embedRhythiansId(data: Uint8Array, extension: string, mapId: string) {
  if (extension === ".rhm") return convertRhmToSspm(data, mapId);
  if (extension === ".sspm") return embedSspm(data, mapId);
  throw new Error("Unsupported map format.");
}

function encryptMapId(mapId: string) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", SSPM_KEY, nonce);
  const ciphertext = Buffer.concat([cipher.update(mapId, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), ciphertext]);
}

function u16(value: number) { const buffer = Buffer.alloc(2); buffer.writeUInt16LE(value & 0xffff); return buffer; }
function u32(value: number) { const buffer = Buffer.alloc(4); buffer.writeUInt32LE(value >>> 0); return buffer; }
function u64(value: number) { const buffer = Buffer.alloc(8); buffer.writeBigUInt64LE(BigInt(value)); return buffer; }
function f32(value: number) { const buffer = Buffer.alloc(4); buffer.writeFloatLE(value); return buffer; }
function string16(value: string) { const data = Buffer.from(value, "utf8"); if (data.length > 0xffff) throw new Error("Map string is too large."); return Buffer.concat([u16(data.length), data]); }

function encodeCustomField(id: string, type: number, value: Buffer) {
  const name = Buffer.from(id, "utf8");
  if (name.length > 0xffff || value.length > 0xffff) throw new Error("SSPM custom field is too large.");
  return Buffer.concat([u16(name.length), name, Buffer.from([type]), u16(value.length), value]);
}

function encodeIdentityField(mapId: string) { return encodeCustomField(SSPM_FIELD, 0x08, encryptMapId(mapId)); }

function readCustomFields(data: Buffer, offset: number, length: number) {
  if (length === 0) return Buffer.from([0, 0]);
  if (offset < 0 || length < 2 || offset + length > data.length) throw new Error("Invalid SSPM custom data block.");
  let cursor = offset;
  const end = offset + length;
  const count = data.readUInt16LE(cursor);
  cursor += 2;
  const fields: Buffer[] = [];
  for (let i = 0; i < count; i += 1) {
    const fieldStart = cursor;
    if (cursor + 3 > end) throw new Error("Invalid SSPM custom field.");
    const nameLength = data.readUInt16LE(cursor);
    cursor += 2;
    if (cursor + nameLength + 1 > end) throw new Error("Invalid SSPM custom field.");
    const name = data.subarray(cursor, cursor + nameLength).toString("utf8");
    cursor += nameLength;
    const type = data[cursor++];
    if (type === 0x01) cursor += 1;
    else if (type === 0x02) cursor += 2;
    else if (type === 0x03 || type === 0x05) cursor += 4;
    else if (type === 0x04 || type === 0x06) cursor += 8;
    else if (type === 0x07) {
      if (cursor + 1 > end) throw new Error("Invalid SSPM position field.");
      const flag = data[cursor++];
      if (flag === 0) cursor += 2;
      else if (flag === 1) cursor += 8;
      else throw new Error("Invalid SSPM position field.");
    } else if (type === 0x08 || type === 0x09) {
      if (cursor + 2 > end) throw new Error("Invalid SSPM buffer field.");
      cursor += 2 + data.readUInt16LE(cursor);
    } else if (type === 0x0a || type === 0x0b || type === 0x0c) {
      if (cursor + 4 > end) throw new Error("Invalid SSPM long field.");
      cursor += 4 + data.readUInt32LE(cursor);
    } else throw new Error("Unsupported SSPM custom field type.");
    if (cursor > end) throw new Error("Invalid SSPM custom field length.");
    if (name !== SSPM_FIELD) fields.push(data.subarray(fieldStart, cursor));
  }
  return Buffer.concat([u16(fields.length), ...fields]);
}

function embedSspm(data: Uint8Array, mapId: string) {
  const source = Buffer.from(data);
  if (source.length < 128 || source.readUInt32LE(0) !== 0x6d2b5353 || source.readUInt16LE(4) !== 2) throw new Error("Only SSPM v2 files are supported.");
  const customOffset = Number(source.readBigUInt64LE(48));
  const customLength = Number(source.readBigUInt64LE(56));
  const existing = readCustomFields(source, customOffset, customLength);
  const count = existing.readUInt16LE(0);
  const identity = encodeIdentityField(mapId);
  const updated = Buffer.concat([u16(count + 1), existing.subarray(2), identity]);
  const output = Buffer.concat([source, updated]);
  output.writeBigUInt64LE(BigInt(source.length), 48);
  output.writeBigUInt64LE(BigInt(updated.length), 56);
  return new Uint8Array(output);
}

function convertRhmToSspm(data: Uint8Array, mapId: string) {
  const files = unzipSync(data);
  const mapEntry = files.map ?? files.Map;
  if (!mapEntry) throw new Error("RHM map entry is missing.");
  const parsed = JSON.parse(new TextDecoder().decode(mapEntry)) as Record<string, unknown>;
  const notes = Array.isArray(parsed.Notes) ? parsed.Notes as Array<Record<string, unknown>> : [];
  const title = String(parsed.Title ?? parsed.SongName ?? "Map");
  const songName = String(parsed.SongName ?? title);
  const legacyId = String(parsed.LegacyId ?? mapId);
  const mappers = Array.isArray(parsed.Mappers) ? parsed.Mappers.map(String) : [];
  const duration = Math.max(0, Number(parsed.Duration ?? 0));
  const difficulty = Math.max(0, Math.min(255, Number(parsed.Difficulty ?? 0)));
  const starRating = Math.max(0, Math.min(6553.5, Number(parsed.StarRating ?? 0)));
  const customDifficultyName = String(parsed.CustomDifficultyName ?? "");
  const audio = files.audio ?? new Uint8Array();
  const cover = files.cover ?? new Uint8Array();
  const markerParts: Buffer[] = [];
  let maxMs = 0;
  for (const note of notes) {
    const time = Math.max(0, Math.floor(Number(note.Time ?? 0)));
    const x = Number(note.X ?? 0);
    const y = Number(note.Y ?? 0);
    maxMs = Math.max(maxMs, time);
    const quantized = Number.isFinite(x) && Number.isFinite(y) && Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x <= 255 && y >= 0 && y <= 255;
    markerParts.push(u32(time), Buffer.from([0]), Buffer.from([quantized ? 0 : 1]));
    if (quantized) markerParts.push(Buffer.from([x, y])); else markerParts.push(f32(x), f32(y));
  }
  const markerData = Buffer.concat(markerParts);
  const metadata = Buffer.concat([string16(legacyId), string16(title), string16(songName), u16(mappers.length), ...mappers.map(string16)]);
  const customFields = [encodeIdentityField(mapId)];
  if (customDifficultyName) customFields.unshift(encodeCustomField("difficulty_name", 0x09, Buffer.from(customDifficultyName, "utf8")));
  const custom = Buffer.concat([u16(customFields.length), ...customFields]);
  const headerSize = 48;
  const pointerSize = 80;
  const metaOffset = headerSize + pointerSize;
  const customOffset = metaOffset + metadata.length;
  const audioOffset = customOffset + custom.length;
  const coverOffset = audioOffset + audio.length;
  const definitionOffset = coverOffset + cover.length;
  const definition = Buffer.concat([Buffer.from([1]), string16("ssp_note"), Buffer.from([1, 0x07, 0])]);
  const markerOffset = definitionOffset + definition.length;
  const lastMs = duration > 0 ? duration : maxMs;
  const header = Buffer.concat([u32(0x6d2b5353), u16(2), Buffer.alloc(4), Buffer.alloc(20), u32(lastMs), u32(notes.length), u32(notes.length), Buffer.from([difficulty]), u16(Math.round(starRating * 10)), Buffer.from([audio.length ? 1 : 0, cover.length ? 1 : 0, 0]), u64(customOffset), u64(custom.length), u64(audio.length ? audioOffset : 0), u64(audio.length), u64(cover.length ? coverOffset : 0), u64(cover.length), u64(definitionOffset), u64(definition.length), u64(markerOffset), u64(markerData.length)]);
  return new Uint8Array(Buffer.concat([header, metadata, custom, Buffer.from(audio), Buffer.from(cover), definition, markerData]));
}

export function isSupportedMapExtension(extension: string) { return extension === ".rhm" || extension === ".sspm"; }
