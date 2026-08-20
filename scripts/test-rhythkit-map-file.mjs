import { zipSync } from "fflate";
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

const rhm = zipSync({
  map: new TextEncoder().encode(JSON.stringify({
    LegacyId: "legacy-map",
    SongName: "Test Song",
    Mappers: ["Mapper"],
    Title: "Test Map",
    Duration: 1234,
    Difficulty: 2,
    CustomDifficultyName: "Hard",
    StarRating: 4.5,
    Notes: [{ Time: 100, X: 1, Y: 2 }, { Time: 500, X: 1.5, Y: 2.25 }],
    AudioFileName: "audio",
    ImagePath: null,
  })),
  audio: new Uint8Array([1, 2, 3]),
});

const converted = Buffer.from(embedRhythiansId(rhm, ".rhm", id));
if (converted.readUInt32LE(0) !== 0x6d2b5353) throw new Error("RHM was not converted to SSPM");
if (converted.readUInt16LE(4) !== 2) throw new Error("Converted map is not SSPM v2");
const customOffset = Number(converted.readBigUInt64LE(48));
const customLength = Number(converted.readBigUInt64LE(56));
if (customOffset <= 0 || customLength <= 0) throw new Error("Converted SSPM custom block is missing");
const custom = converted.subarray(customOffset, customOffset + customLength);
if (!custom.includes(Buffer.from("rhythians_id_enc_v1"))) throw new Error("Converted SSPM identity field is missing");

console.log("RhythKit SSPM identity and RHM conversion passed");
