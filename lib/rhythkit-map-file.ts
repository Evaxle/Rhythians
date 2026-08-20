import crypto from "node:crypto";
import { unzipSync, zipSync } from "fflate";

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
  if (extension === ".rhm") return embedRhm(data, mapId);
  if (extension === ".sspm") return embedSspm(data, mapId);
  return data;
}

function encryptMapId(mapId: string) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", SSPM_KEY, nonce);
  const ciphertext = Buffer.concat([cipher.update(mapId, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), ciphertext]);
}

function embedSspm(data: Uint8Array, mapId: string) {
  const source = Buffer.from(data);
  if (source.length < 128 || source.readUInt32LE(0) !== 0x6d2b5353 || source.readUInt16LE(4) !== 2) throw new Error("Only SSPM v2 files are supported for encrypted Rhythians identity embedding.");
  const customOffset = Number(source.readBigUInt64LE(48));
  const customLength = Number(source.readBigUInt64LE(56));
  const custom = customLength > 0 ? Buffer.from(source.subarray(customOffset, customOffset + customLength)) : Buffer.from([0, 0]);
  if (custom.length < 2) throw new Error("Invalid SSPM custom data block.");
  const fieldId = Buffer.from(SSPM_FIELD, "utf8");
  const payload = encryptMapId(mapId);
  if (fieldId.length > 0xffff || payload.length > 0xffff) throw new Error("Rhythians SSPM identity is too large.");
  custom.writeUInt16LE(custom.readUInt16LE(0) + 1, 0);
  const field = Buffer.alloc(2 + fieldId.length + 1 + 2 + payload.length);
  field.writeUInt16LE(fieldId.length, 0);
  field.set(fieldId, 2);
  field[2 + fieldId.length] = 0x08;
  field.writeUInt16LE(payload.length, 3 + fieldId.length);
  field.set(payload, 5 + fieldId.length);
  const updatedCustom = Buffer.concat([custom, field]);
  const output = Buffer.concat([source, updatedCustom]);
  output.writeBigUInt64LE(BigInt(source.length), 48);
  output.writeBigUInt64LE(BigInt(updatedCustom.length), 56);
  return new Uint8Array(output);
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
