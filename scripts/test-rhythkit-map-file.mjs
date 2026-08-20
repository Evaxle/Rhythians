import { embedRhythiansId } from "../lib/rhythkit-map-file.ts";

const id = "123e4567-e89b-12d3-a456-426614174000";
const source = Buffer.alloc(128);
source.writeUInt32LE(0x6d2b5353, 0);
source.writeUInt16LE(2, 4);
source.writeBigUInt64LE(0n, 48);
source.writeBigUInt64LE(0n, 56);
const output = Buffer.from(embedRhythiansId(source, ".sspm", id));
if (output.length <= source.length) throw new Error("SSPM identity was not appended");
if (output.readBigUInt64LE(48) !== 128n) throw new Error("SSPM custom offset is incorrect");
if (output.readUInt16LE(128) !== 1) throw new Error("SSPM field count is incorrect");
const fieldIdLength = output.readUInt16LE(130);
const fieldId = output.subarray(132, 132 + fieldIdLength).toString("utf8");
if (fieldId !== "rhythians_id_enc_v1") throw new Error("Encrypted SSPM identity field is missing");
if (output[132 + fieldIdLength] !== 0x08) throw new Error("Encrypted SSPM identity field type is incorrect");
console.log("RhythKit SSPM identity embedding passed");
