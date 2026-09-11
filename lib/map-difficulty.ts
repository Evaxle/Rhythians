import { unzipSync } from "fflate";
import { roundRating } from "@/lib/ranks";

export const MAP_ANALYZER_VERSION = 5;
export const MIN_ANALYSIS_NOTES = 3;

export type MapNote = { time: number; x: number; y: number };
export type MapPattern = "rest" | "stream" | "stream-lean" | "mixed" | "jump-lean" | "jump";
export type MapSectionAnalysis = {
  startMs: number;
  endMs: number;
  strain: number;
  nps: number;
  jumpness: number;
  direction: number;
  distance: number;
  timingPressure?: number;
  cheeseRatio?: number;
  pattern: Exclude<MapPattern, "rest">;
};
export type MapPatternSegment = {
  startMs: number;
  endMs: number;
  pattern: MapPattern;
  averageStrain: number;
  peakStrain: number;
  averageNps: number;
  jumpness: number;
  direction: number;
  distance: number;
  timingPressure?: number;
  cheeseRatio?: number;
};
export type MapModeRewards = { lock: number; vr: number; spin: number };
export type MapSpeedProfile = { speed: number; rating: number; rewards: MapModeRewards };

export type DifficultyCoverage = {
  easy: number;
  moderate: number;
  hard: number;
  peak: number;
};

export type MapDifficultyDetails = {
  coreDifficulty: number;
  sustainedDifficulty: number;
  peakDifficulty: number;
  staminaDifficulty: number;
  movementPressure: number;
  directionPressure: number;
  distancePressure: number;
  timingPressure: number;
  jumpPressure: number;
  streamPressure: number;
  techPressure: number;
  cheeseRatio: number;
  activeDuty: number;
  recoveryRatio: number;
  patternDiversity: number;
  difficultyConsistency: number;
  coverage: DifficultyCoverage;
  windows: {
    micro: number;
    short: number;
    medium: number;
    long: number;
  };
};

export type MapDifficultyAnalysis = {
  version: number;
  rating: number;
  directionScore: number;
  distanceScore: number;
  npsScore: number;
  staminaIndex: number;
  activeDurationMs: number;
  longestHardSectionMs: number;
  peakJumpNps: number;
  peakStreamNps: number;
  peakJumpStrain: number;
  peakStreamStrain: number;
  jumpRatio: number;
  noteCount: number;
  rewards: MapModeRewards;
  speedProfiles: MapSpeedProfile[];
  topSections: MapSectionAnalysis[];
  patternSegments: MapPatternSegment[];
  details: MapDifficultyDetails;
};

type MarkerDefinition = { id: string; types: number[] };
type Transition = {
  time: number;
  deltaMs: number;
  strain: number;
  nps: number;
  jumpness: number;
  direction: number;
  distance: number;
  timingPressure: number;
  cheeseRatio: number;
};
type SpeedAnalysis = {
  rating: number;
  staminaIndex: number;
  activeDurationMs: number;
  longestHardSectionMs: number;
  sections: MapSectionAnalysis[];
  transitions: Transition[];
  details: MapDifficultyDetails;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(p, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const amount = position - lower;
  return sorted[lower] * (1 - amount) + sorted[upper] * amount;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function deviation(values: number[]) {
  const average = mean(values);
  return values.length ? Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length) : 0;
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function readString16(buffer: Buffer, cursor: number, end = buffer.length) {
  if (cursor + 2 > end) throw new Error("Invalid SSPM string.");
  const length = buffer.readUInt16LE(cursor);
  cursor += 2;
  if (cursor + length > end) throw new Error("Invalid SSPM string length.");
  return { value: buffer.subarray(cursor, cursor + length).toString("utf8"), cursor: cursor + length };
}

function skipMarkerValue(buffer: Buffer, cursor: number, type: number, end: number) {
  if (type === 0x01) cursor += 1;
  else if (type === 0x02) cursor += 2;
  else if (type === 0x03 || type === 0x05) cursor += 4;
  else if (type === 0x04 || type === 0x06) cursor += 8;
  else if (type === 0x08 || type === 0x09) {
    if (cursor + 2 > end) throw new Error("Invalid SSPM buffer value.");
    cursor += 2 + buffer.readUInt16LE(cursor);
  } else if (type === 0x0a || type === 0x0b) {
    if (cursor + 4 > end) throw new Error("Invalid SSPM long value.");
    cursor += 4 + buffer.readUInt32LE(cursor);
  } else if (type === 0x0c) {
    throw new Error("SSPM marker arrays are not supported.");
  } else {
    throw new Error(`Unsupported SSPM marker value type ${type}.`);
  }
  if (cursor > end) throw new Error("Invalid SSPM marker value length.");
  return cursor;
}

export function parseSspmNotes(data: Uint8Array): MapNote[] {
  const buffer = Buffer.from(data);
  if (buffer.length < 128 || buffer.readUInt32LE(0) !== 0x6d2b5353 || buffer.readUInt16LE(4) !== 2) {
    throw new Error("Only SSPM v2 maps can be analyzed.");
  }

  const markerCount = buffer.readUInt32LE(38);
  const definitionsOffset = Number(buffer.readBigUInt64LE(96));
  const definitionsLength = Number(buffer.readBigUInt64LE(104));
  const markersOffset = Number(buffer.readBigUInt64LE(112));
  const markersLength = Number(buffer.readBigUInt64LE(120));

  if (
    definitionsOffset < 0 ||
    markersOffset < 0 ||
    definitionsOffset + definitionsLength > buffer.length ||
    markersOffset + markersLength > buffer.length
  ) {
    throw new Error("SSPM map pointers are invalid.");
  }

  let cursor = definitionsOffset;
  const definitionsEnd = definitionsOffset + definitionsLength;
  if (cursor >= definitionsEnd) throw new Error("SSPM map has no marker definitions.");

  const definitionCount = buffer[cursor++];
  const definitions: MarkerDefinition[] = [];

  for (let i = 0; i < definitionCount; i += 1) {
    const name = readString16(buffer, cursor, definitionsEnd);
    cursor = name.cursor;
    if (cursor >= definitionsEnd) throw new Error("Invalid SSPM marker definition.");

    const valueCount = buffer[cursor++];
    const types: number[] = [];
    for (let j = 0; j < valueCount; j += 1) {
      if (cursor >= definitionsEnd) throw new Error("Invalid SSPM marker definition values.");
      const type = buffer[cursor++];
      types.push(type);
      if (type === 0x0c) {
        if (cursor >= definitionsEnd) throw new Error("Invalid SSPM array definition.");
        cursor += 1;
      }
    }

    if (cursor >= definitionsEnd || buffer[cursor++] !== 0) {
      throw new Error("Invalid SSPM marker definition terminator.");
    }
    definitions.push({ id: name.value, types });
  }

  const noteType = definitions.findIndex((definition) => definition.id === "ssp_note");
  if (noteType < 0) throw new Error("SSPM map does not define ssp_note markers.");

  const notes: MapNote[] = [];
  cursor = markersOffset;
  const markersEnd = markersOffset + markersLength;

  for (let marker = 0; marker < markerCount && cursor < markersEnd; marker += 1) {
    if (cursor + 5 > markersEnd) throw new Error("Invalid SSPM marker block.");

    const time = buffer.readUInt32LE(cursor);
    cursor += 4;
    const markerType = buffer[cursor++];
    const definition = definitions[m²È="25¹AÉ•ÍÍÕÉ”¤°(€€€‘¥ÍÑ…¹•AÉ•ÍÍÕÉ”èÉ½Õ¹¡‘¥ÍÑ…¹•AÉ•ÍÍÕÉ”¤°(€€€Ñ¥µ¥¹AÉ•ÍÍÕÉ”èÉ½Õ¹¡Ñ¥µ¥¹AÉ•ÍÍÕÉ”¤°(€€€©ÕµÁAÉ•ÍÍÕÉ”èÉ½Õ¹¡©ÕµÁAÉ•ÍÍÕÉ”¤°(€€€ÍÑÉ•…µAÉ•ÍÍÕÉ”èÉ½Õ¹¡ÍÑÉ•…µAÉ•ÍÍÕÉ”¤°(€€€Ñ•¡AÉ•ÍÍÕÉ”èÉ½Õ¹¡Ñ•¡AÉ•ÍÍÕÉ”¤°(€€€¡••Í•I…Ñ¥¼èÉ½Õ¹¡¡••Í•I…Ñ¥¼¤°(€€€…Ñ¥Ù•ÕÑäèÉ½Õ¹¡…Ñ¥Ù•ÕÑä¤°(€€€É•½Ù•ÉåI…Ñ¥¼èÉ½Õ¹¡É•½Ù•ÉåI…Ñ¥¼¤°(€€€Á…ÑÑ•É¹¥Ù•ÉÍ¥ÑäèÉ½Õ¹¡Á…ÑÑ•É¹¥Ù•ÉÍ¥Ñä¡Í•Ñ¥½¹Ì¤¤°(€€€‘¥™™¥Õ±Ñå½¹Í¥ÍÑ•¹äèÉ½Õ¹¡½¹Í¥ÍÑ•¹ä¤°(€€€½Ù•É…”è½Ù•É…•É½µM•Ñ¥½¹Ì¡Í•Ñ¥½¹Ì¤°(€€€Ý¥¹‘½ÝÌèì(€€€€€µ¥É¼èÉ½Õ¹¡µ¥É¼¤°(€€€€€Í¡½ÉÐèÉ½Õ¹¡Í¡½ÉÐ¤°(€€€€€µ•‘¥Õ´èÉ½Õ¹¡µ•‘¥Õ´¤°(€€€€€±½¹œèÉ½Õ¹¡±½¹œ¤°(€€€ô°(€ôì((€É•ÑÕÉ¸ì(€€€É…Ñ¥¹œ°(€€€ÍÑ…µ¥¹…%¹‘•à°(€€€…Ñ¥Ù•ÕÉ…Ñ¥½¹5Ì°(€€€±½¹•ÍÑ!…É‘M•Ñ¥½¹5Ì°(€€€Í•Ñ¥½¹Ì°(€€€ÑÉ…¹Í¥Ñ¥½¹Ì°(€€€‘•Ñ…¥±Ì°(€ôì)ô()™Õ¹Ñ¥½¸‰Õ¥±‘A…ÑÑ•É¹M•µ•¹ÑÌ¡Í•Ñ¥½¹Ìè5…ÁM•Ñ¥½¹¹…±åÍ¥Ímt°•¹‘5Ìè¹Õµ‰•È¤è5…ÁA…ÑÑ•É¹M•µ•¹Ñmtì(€¥˜€¡•¹‘5Ì€ðô€À¤É•ÑÕÉ¸mtì((€½¹ÍÐÍ•Ñ¥½¹5…À€ô¹•Ü5…À¡Í•Ñ¥½¹Ì¹µ…À ¡Í•Ñ¥½¸¤€ôøm5…Ñ ¹™±½½È¡Í•Ñ¥½¸¹ÍÑ…ÉÑ5Ì€¼€ÄÔÀÀ¤°Í•Ñ¥½¹t¤¤ì(€½¹ÍÐ‰Õ­•Ñ½Õ¹Ð€ô5…Ñ ¹µ…à Ä°5…Ñ ¹•¥°¡•¹‘5Ì€¼€ÄÔÀÀ¤¤ì((€½¹ÍÐ‰Õ­•ÑÌ€ôÉÉ…ä¹™É½´¡ì±•¹Ñ è‰Õ­•Ñ½Õ¹Ðô°€¡|°¥¹‘•à¤€ôøì(€€€½¹ÍÐÍ•Ñ¥½¸€ôÍ•Ñ¥½¹5…À¹•Ð¡¥¹‘•à¤ì(€€€¥˜€ …Í•Ñ¥½¸¤ì(€€€€€É•ÑÕÉ¸ì(€€€€€€€ÍÑ…ÉÑ5Ìè¥¹‘•à€¨€ÄÔÀÀ°(€€€€€€€•¹‘5Ìè5…Ñ ¹µ¥¸¡•¹‘5Ì°¥¹‘•à€¨€ÄÔÀÀ€¬€ÄÔÀÀ¤°(€€€€€€€Á…ÑÑ•É¸è€‰É•ÍÐˆ…Ì½¹ÍÐ°(€€€€€€€ÍÑÉ…¥¸è€À°(€€€€€€€Á•…¬è€À°(€€€€€€€¹ÁÌè€À°(€€€€€€€©ÕµÁ¹•ÍÌè€À°(€€€€€€€‘¥É•Ñ¥½¸è€À°(€€€€€€€‘¥ÍÑ…¹”è€À°(€€€€€€€Ñ¥µ¥¹AÉ•ÍÍÕÉ”è€À°(€€€€€€€¡••Í•I…Ñ¥¼è€À°(€€€€€ôì(€€€ô((€€€É•ÑÕÉ¸ì(€€€€€ÍÑ…ÉÑ5ÌèÍ•Ñ¥½¸¹ÍÑ…ÉÑ5Ì°(€€€€€•¹‘5Ìè5…Ñ ¹µ¥¸¡•¹‘5Ì°Í•Ñ¥½¸¹•¹‘5Ì¤°(€€€€€Á…ÑÑ•É¸èÍ•Ñ¥½¸¹Á…ÑÑ•É¸…Ì5…ÁA…ÑÑ•É¸°(€€€€€ÍÑÉ…¥¸èÍ•Ñ¥½¸¹ÍÑÉ…¥¸°(€€€€€Á•…¬èÍ•Ñ¥½¸¹ÍÑÉ…¥¸°(€€€€€¹ÁÌèÍ•Ñ¥½¸¹¹ÁÌ°(€€€€€©ÕµÁ¹•ÍÌèÍ•Ñ¥½¸¹©ÕµÁ¹•ÍÌ°(€€€€€‘¥É•Ñ¥½¸èÍ•Ñ¥½¸¹‘¥É•Ñ¥½¸°(€€€€€‘¥ÍÑ…¹”èÍ•Ñ¥½¸¹‘¥ÍÑ…¹”°(€€€€€Ñ¥µ¥¹AÉ•ÍÍÕÉ”èÍ•Ñ¥½¸¹Ñ¥µ¥¹AÉ•ÍÍÕÉ”€üü€À°(€€€€€¡••Í•I…Ñ¥¼èÍ•Ñ¥½¸¹¡••Í•I…Ñ¥¼€üü€À°(€€€ôì(€ô¤¹™¥±Ñ•È ¡‰Õ­•Ð¤€ôø‰Õ­•Ð¹•¹‘5Ì€ø‰Õ­•Ð¹ÍÑ…ÉÑ5Ì¤ì((€½¹ÍÐÉ½ÕÁÌèÑåÁ•½˜‰Õ­•ÑÍmt€ômtì(€™½È€¡½¹ÍÐ‰Õ­•Ð½˜‰Õ­•ÑÌ¤ì(€€€½¹ÍÐ±…ÍÐ€ôÉ½ÕÁÍmÉ½ÕÁÌ¹±•¹Ñ €´€Åtì(€€€¥˜€ (€€€€€±…ÍÐ€˜˜(€€€€€±…ÍÑm±…ÍÐ¹±•¹Ñ €´€Åt¹Á…ÑÑ•É¸€ôôô‰Õ­•Ð¹Á…ÑÑ•É¸€˜˜(€€€€€±…ÍÑm±…ÍÐ¹±•¹Ñ €´€Åt¹•¹‘5Ì€ôôô‰Õ­•Ð¹ÍÑ…ÉÑ5Ì(€€€€¤ì(€€€€€±…ÍÐ¹ÁÕÍ ¡‰Õ­•Ð¤ì(€€€ô•±Í”ì(€€€€€É½ÕÁÌ¹ÁÕÍ ¡m‰Õ­•Ñt¤ì(€€€ô(€ô((€É•ÑÕÉ¸É½ÕÁÌ¹µ…À ¡É½ÕÀ¤€ôøì(€€€½¹ÍÐÁ…ÑÑ•É¸€ôÉ½ÕÁlÁt¹Á…ÑÑ•É¸ì(€€€½¹ÍÐ…Ù•É…”€ô€¡­•äè€‰ÍÑÉ…¥¸ˆð€‰¹ÁÌˆð€‰©ÕµÁ¹•ÍÌˆð€‰‘¥É•Ñ¥½¸ˆð€‰‘¥ÍÑ…¹”ˆð€‰Ñ¥µ¥¹AÉ•ÍÍÕÉ”ˆð€‰¡••Í•I…Ñ¥¼ˆ¤€ôø(€€€€€µ•…¸¡É½ÕÀ¹µ…À ¡Ù…±Õ”¤€ôøÙ…±Õ•m­•åt¤¤ì((€€€É•ÑÕÉ¸ì(€€€€€ÍÑ…ÉÑ5ÌèÉ½ÕÁlÁt¹ÍÑ…ÉÑ5Ì°(€€€€€•¹‘5ÌèÉ½ÕÁmÉ½ÕÀ¹±•¹Ñ €´€Åt¹•¹‘5Ì°(€€€€€Á…ÑÑ•É¸°(€€€€€…Ù•É…•MÑÉ…¥¸èÉ½Õ¹‘I…Ñ¥¹œ¡…Ù•É…” ‰ÍÑÉ…¥¸ˆ¤¤°(€€€€€Á•…­MÑÉ…¥¸èÉ½Õ¹‘I…Ñ¥¹œ¡5…Ñ ¹µ…à ¸¸¹É½ÕÀ¹µ…À ¡Ù…±Õ”¤€ôøÙ…±Õ”¹Á•…¬¤¤¤°(€€€€€…Ù•É…•9ÁÌèÉ½Õ¹‘I…Ñ¥¹œ¡…Ù•É…” ‰¹ÁÌˆ¤¤°(€€€€€©ÕµÁ¹•ÍÌèÉ½Õ¹‘I…Ñ¥¹œ¡…Ù•É…” ‰©ÕµÁ¹•ÍÌˆ¤¤°(€€€€€‘¥É•Ñ¥½¸èÉ½Õ¹‘I…Ñ¥¹œ¡…Ù•É…” ‰‘¥É•Ñ¥½¸ˆ¤¤°(€€€€€‘¥ÍÑ…¹”èÉ½Õ¹‘I…Ñ¥¹œ¡…Ù•É…” ‰‘¥ÍÑ…¹”ˆ¤¤°(€€€€€Ñ¥µ¥¹AÉ•ÍÍÕÉ”èÉ½Õ¹‘I…Ñ¥¹œ¡…Ù•É…” ‰Ñ¥µ¥¹AÉ•ÍÍÕÉ”ˆ¤¤°(€€€€€¡••Í•I…Ñ¥¼èÉ½Õ¹‘I…Ñ¥¹œ¡…Ù•É…” ‰¡••Í•I…Ñ¥¼ˆ¤¤°(€€€ôì(€ô¤ì)ô()•áÁ½ÉÐ™Õ¹Ñ¥½¸…¹…±åé•5…Á9½Ñ•Ì¡¹½Ñ•Ìè5…Á9½Ñ•mt¤è5…Á¥™™¥Õ±Ñå¹…±åÍ¥Ìì(€½¹ÍÐ±•…¸€ô¹½Ñ•Ì(€€€€¹™¥±Ñ•È ¡¹½Ñ”¤€ôø9Õµ‰•È¹¥Í¥¹¥Ñ”¡¹½Ñ”¹Ñ¥µ”¤€˜˜9Õµ‰•È¹¥Í¥¹¥Ñ”¡¹½Ñ”¹à¤€˜˜9Õµ‰•È¹¥Í¥¹¥Ñ”¡¹½Ñ”¹ä¤¤(€€€€¹Í½ÉÐ ¡„°ˆ¤€ôø„¹Ñ¥µ”€´ˆ¹Ñ¥µ”¤ì((€¥˜€¡±•…¸¹±•¹Ñ €ð5%9}91eM%M}9=QL¤ì(€€€Ñ¡É½Ü¹•ÜÉÉ½È¡5…À¹••‘Ì…Ð±•…ÍÐ€‘í5%9}91eM%M}9=QMôÙ…±¥¹½Ñ•Ì™½È‘¥™™¥Õ±Ñä…¹…±åÍ¥Ì¹€¤ì(€ô((€½¹ÍÐ‰…Í”€ô…¹…±åé•ÑMÁ••¡±•…¸°€Ä¤ì(€½¹ÍÐ‘¥É•Ñ¥½¹M½É”€ôÉ½Õ¹‘I…Ñ¥¹œ¡±…µÀ¡‰…Í”¹‘•Ñ…¥±Ì¹‘¥É•Ñ¥½¹AÉ•ÍÍÕÉ”€¨€ÄÀ°€À°€ÄÀ¤¤ì(€½¹ÍÐ‘¥ÍÑ…¹•M½É”€ôÉ½Õ¹‘I…Ñ¥¹œ¡±…µÀ¡‰…Í”¹‘•Ñ…¥±Ì¹‘¥ÍÑ…¹•AÉ•ÍÍÕÉ”€¨€ÄÀ°€À°€ÄÀ¤¤ì(€½¹ÍÐ¹ÁÍM½É”€ôÉ½Õ¹‘I…Ñ¥¹œ¡±…µÀ¡‰…Í”¹‘•Ñ…¥±Ì¹Ñ¥µ¥¹AÉ•ÍÍÕÉ”€¼€À¸ÐÈ°€À°€ÄÀ¤¤ì((€½¹ÍÐ©ÕµÁQÉ…¹Í¥Ñ¥½¹Ì€ô‰…Í”¹ÑÉ…¹Í¥Ñ¥½¹Ì¹™¥±Ñ•È ¡Ù…±Õ”¤€ôøÙ…±Õ”¹©ÕµÁ¹•ÍÌ€øô€À¸ÔÔ¤ì(€½¹ÍÐÍÑÉ•…µQÉ…¹Í¥Ñ¥½¹Ì€ô‰…Í”¹ÑÉ…¹Í¥Ñ¥½¹Ì¹™¥±Ñ•È ¡Ù…±Õ”¤€ôøÙ…±Õ”¹©ÕµÁ¹•ÍÌ€ð€À¸Ð¤ì((€½¹ÍÐÁ•…­)ÕµÁ9ÁÌ€ôÉ½Õ¹‘I…Ñ¥¹œ¡Á•É•¹Ñ¥±”¡©ÕµÁQÉ…¹Í¥Ñ¥½¹Ì¹µ…À ¡Ù…±Õ”¤€ôøÙ…±Õ”¹¹ÁÌ¤°€À¸äÈ¤¤ì(€½¹ÍÐÁ•…­MÑÉ•…µ9ÁÌ€ôÉ½Õ¹‘I…Ñ¥¹œ¡Á•É•¹Ñ¥±”¡ÍÑÉ•…µQÉ…¹Í¥Ñ¥½¹Ì¹µ…À ¡Ù…±Õ”¤€ôøÙ…±Õ”¹¹ÁÌ¤°€À¸äÈ¤¤ì(€½¹ÍÐÁ•…­)ÕµÁMÑÉ…¥¸€ôÉ½Õ¹‘I…Ñ¥¹œ¡Á•É•¹Ñ¥±”¡©ÕµÁQÉ…¹Í¥Ñ¥½¹Ì¹µ…À ¡Ù…±Õ”¤€ôøÙ…±Õ”¹ÍÑÉ…¥¸¤°€À¸ä¤¤ì(€½¹ÍÐÁ•…­MÑÉ•…µMÑÉ…¥¸€ôÉ½Õ¹‘I…Ñ¥¹œ¡Á•É•¹Ñ¥±”¡ÍÑÉ•…µQÉ…¹Í¥Ñ¥½¹Ì¹µ…À ¡Ù…±Õ”¤€ôøÙ…±Õ”¹ÍÑÉ…¥¸¤°€À¸ä¤¤ì((€½¹ÍÐÝ•¥¡Ñ•‘)ÕµÀ€ô‰…Í”¹ÑÉ…¹Í¥Ñ¥½¹Ì¹É•‘Õ” (€€€€¡ÍÕ´°Ù…±Õ”¤€ôøÍÕ´€¬Ù…±Õ”¹©ÕµÁ¹•ÍÌ€¨5…Ñ ¹µ…à À¸ÀÄ°Ù…±Õ”¹ÍÑÉ…¥¸¤°(€€€€À°(€€¤ì(€½¹ÍÐÑ½Ñ…±]•¥¡Ð€ô‰…Í”¹ÑÉ…¹Í¥Ñ¥½¹Ì¹É•‘Õ” ¡ÍÕ´°Ù…±Õ”¤€ôøÍÕ´€¬5…Ñ ¹µ…à À¸ÀÄ°Ù…±Õ”¹ÍÑÉ…¥¸¤°€À¤ì(€½¹ÍÐ©ÕµÁI…Ñ¥¼€ôÉ½Õ¹‘I…Ñ¥¹œ¡±…µÀ¡Ý•¥¡Ñ•‘)ÕµÀ€¼5…Ñ ¹µ…à À¸ÀÄ°Ñ½Ñ…±]•¥¡Ð¤°€À°€Ä¤¤ì((€½¹ÍÐÉ•Ý…É‘Ì€ôµ½‘•I•Ý…É‘Ì¡‰…Í”¹É…Ñ¥¹œ°‰…Í”¹ÍÑ…µ¥¹…%¹‘•à¤ì(€½¹ÍÐÍÁ••‘AÉ½™¥±•Ìè5…ÁMÁ••‘AÉ½™¥±•mt€ômtì((€™½È€¡±•ÐÍÑ•À€ô€ÄÀìÍÑ•À€ðô€ÐÀìÍÑ•À€¬ô€Ä¤ì(€€€½¹ÍÐÍÁ••€ôÍÑ•À€¼€ÈÀì(€€€½¹ÍÐ…¹…±åÍ¥Ì€ôÍÁ••€ôôô€Ä€ü‰…Í”€è…¹…±åé•ÑMÁ••¡±•…¸°ÍÁ••¤ì(€€€ÍÁ••‘AÉ½™¥±•Ì¹ÁÕÍ ¡ì(€€€€€ÍÁ••èÉ½Õ¹‘I…Ñ¥¹œ¡ÍÁ••¤°(€€€€€É…Ñ¥¹œè…¹…±åÍ¥Ì¹É…Ñ¥¹œ°(€€€€€É•Ý…É‘Ìèµ½‘•I•Ý…É‘Ì¡…¹…±åÍ¥Ì¹É…Ñ¥¹œ°…¹…±åÍ¥Ì¹ÍÑ…µ¥¹…%¹‘•à¤°(€€€ô¤ì(€ô((€½¹ÍÐÑ½ÁM•Ñ¥½¹Ì€ôl¸¸¹‰…Í”¹Í•Ñ¥½¹Ít(€€€€¹Í½ÉÐ ¡„°ˆ¤€ôøˆ¹ÍÑÉ…¥¸€´„¹ÍÑÉ…¥¸¤(€€€€¹Í±¥” À°€ÄÈ¤(€€€€¹µ…À ¡Í•Ñ¥½¸¤€ôø€¡ì(€€€€€€¸¸¹Í•Ñ¥½¸°(€€€€€ÍÑÉ…¥¸èÉ½Õ¹‘I…Ñ¥¹œ¡Í•Ñ¥½¸¹ÍÑÉ…¥¸¤°(€€€€€¹ÁÌèÉ½Õ¹‘I…Ñ¥¹œ¡Í•Ñ¥½¸¹¹ÁÌ¤°(€€€€€©ÕµÁ¹•ÍÌèÉ½Õ¹‘I…Ñ¥¹œ¡Í•Ñ¥½¸¹©ÕµÁ¹•ÍÌ¤°(€€€€€‘¥É•Ñ¥½¸èÉ½Õ¹‘I…Ñ¥¹œ¡Í•Ñ¥½¸¹‘¥É•Ñ¥½¸¤°(€€€€€‘¥ÍÑ…¹”èÉ½Õ¹‘I…Ñ¥¹œ¡Í•Ñ¥½¸¹‘¥ÍÑ…¹”¤°(€€€€€Ñ¥µ¥¹AÉ•ÍÍÕÉ”èÉ½Õ¹‘I…Ñ¥¹œ¡Í•Ñ¥½¸¹Ñ¥µ¥¹AÉ•ÍÍÕÉ”€üü€À¤°(€€€€€¡••Í•I…Ñ¥¼èÉ½Õ¹‘I…Ñ¥¹œ¡Í•Ñ¥½¸¹¡••Í•I…Ñ¥¼€üü€À¤°(€€€ô¤¤ì((€½¹ÍÐÁ…ÑÑ•É¹M•µ•¹ÑÌ€ô‰Õ¥±‘A…ÑÑ•É¹M•µ•¹ÑÌ (€€€‰…Í”¹Í•Ñ¥½¹Ì°(€€€5…Ñ ¹µ…à¡±•…¹m±•…¸¹±•¹Ñ €´€Åt¹Ñ¥µ”°€ÄÔÀÀ¤°(€€¤ì((€É•ÑÕÉ¸ì(€€€Ù•ÉÍ¥½¸è5A}91eiI}YIM%=8°(€€€É…Ñ¥¹œè‰…Í”¹É…Ñ¥¹œ°(€€€‘¥É•Ñ¥½¹M½É”°(€€€‘¥ÍÑ…¹•M½É”°(€€€¹ÁÍM½É”°(€€€ÍÑ…µ¥¹…%¹‘•àèÉ½Õ¹‘I…Ñ¥¹œ¡‰…Í”¹ÍÑ…µ¥¹…%¹‘•à¤°(€€€…Ñ¥Ù•ÕÉ…Ñ¥½¹5Ìè‰…Í”¹…Ñ¥Ù•ÕÉ…Ñ¥½¹5Ì°(€€€±½¹•ÍÑ!…É‘M•Ñ¥½¹5Ìè‰…Í”¹±½¹•ÍÑ!…É‘M•Ñ¥½¹5Ì°(€€€Á•…­)ÕµÁ9ÁÌ°(€€€Á•…­MÑÉ•…µ9ÁÌ°(€€€Á•…­)ÕµÁMÑÉ…¥¸°(€€€Á•…­MÑÉ•…µMÑÉ…¥¸°(€€€©ÕµÁI…Ñ¥¼°(€€€¹½Ñ•½Õ¹Ðè±•…¸¹±•¹Ñ °(€€€É•Ý…É‘Ì°(€€€ÍÁ••‘AÉ½™¥±•Ì°(€€€Ñ½ÁM•Ñ¥½¹Ì°(€€€Á…ÑÑ•É¹M•µ•¹ÑÌ°(€€€‘•Ñ…¥±Ìè‰…Í”¹‘•Ñ…¥±Ì°(€ôì)ô()•áÁ½ÉÐ™Õ¹Ñ¥½¸…¹…±åé•5…Á	åÑ•Ì¡‘…Ñ„èU¥¹ÐáÉÉ…ä¤ì(€É•ÑÕÉ¸…¹…±åé•5…Á9½Ñ•Ì¡Á…ÉÍ•5…Á9½Ñ•Ì¡‘…Ñ„¤¤ì)ô()•áÁ½ÉÐ™Õ¹Ñ¥½¸ÍÁ••‘AÉ½™¥±•Ð¡ÁÉ½™¥±•Ìè5…ÁMÁ••‘AÉ½™¥±•mt°É•ÅÕ•ÍÑ•‘MÁ••è¹Õµ‰•Èð¹Õ±°ðÕ¹‘•™¥¹•¤ì(€¥˜€ …ÁÉ½™¥±•Ì¹±•¹Ñ ¤É•ÑÕÉ¸¹Õ±°ì((€½¹ÍÐÍÁ••€ô±…µÀ¡9Õµ‰•È¡É•ÅÕ•ÍÑ•‘MÁ••¤ñð€Ä°€À¸Ô°€È¤ì(€½¹ÍÐÍ½ÉÑ•€ôl¸¸¹ÁÉ½™¥±•Ít¹Í½ÉÐ ¡„°ˆ¤€ôø„¹ÍÁ••€´ˆ¹ÍÁ••¤ì(€½¹ÍÐ•á…Ð€ôÍ½ÉÑ•¹™¥¹ ¡ÁÉ½™¥±”¤€ôø5…Ñ ¹…‰Ì¡ÁÉ½™¥±”¹ÍÁ••€´ÍÁ••¤€ð€À¸ÀÀÀÄ¤ì(€¥˜€¡•á…Ð¤É•ÑÕÉ¸•á…Ðì((€½¹ÍÐ±½Ý•È€ôl¸¸¹Í½ÉÑ•‘t¹É•Ù•ÉÍ” ¤¹™¥¹ ¡ÁÉ½™¥±”¤€ôøÁÉ½™¥±”¹ÍÁ••€ðÍÁ••¤€üüÍ½ÉÑ•‘lÁtì(€½¹ÍÐÕÁÁ•È€ôÍ½ÉÑ•¹™¥¹ ¡ÁÉ½™¥±”¤€ôøÁÉ½™¥±”¹ÍÁ••€øÍÁ••¤€üüÍ½ÉÑ•‘mÍ½ÉÑ•¹±•¹Ñ €´€Åtì(€¥˜€¡±½Ý•È¹ÍÁ••€ôôôÕÁÁ•È¹ÍÁ••¤É•ÑÕÉ¸±½Ý•Èì((€½¹ÍÐ…µ½Õ¹Ð€ô€¡ÍÁ••€´±½Ý•È¹ÍÁ••¤€¼€¡ÕÁÁ•È¹ÍÁ••€´±½Ý•È¹ÍÁ••¤ì(€½¹ÍÐ¥¹Ñ•ÉÁ½±…Ñ”€ô€¡„è¹Õµ‰•È°ˆè¹Õµ‰•È¤€ôø„€¬€¡ˆ€´„¤€¨…µ½Õ¹Ðì((€É•ÑÕÉ¸ì(€€€ÍÁ••èÉ½Õ¹‘I…Ñ¥¹œ¡ÍÁ••¤°(€€€É…Ñ¥¹œèÉ½Õ¹‘I…Ñ¥¹œ¡¥¹Ñ•ÉÁ½±…Ñ”¡±½Ý•È¹É…Ñ¥¹œ°ÕÁÁ•È¹É…Ñ¥¹œ¤¤°(€€€É•Ý…É‘Ìèì(€€€€€±½¬è5…Ñ ¹É½Õ¹¡¥¹Ñ•ÉÁ½±…Ñ”¡±½Ý•È¹É•Ý…É‘Ì¹±½¬°ÕÁÁ•È¹É•Ý…É‘Ì¹±½¬¤¤°(€€€€€ÙÈè5…Ñ ¹É½Õ¹¡¥¹Ñ•ÉÁ½±…Ñ”¡±½Ý•È¹É•Ý…É‘Ì¹ÙÈ°ÕÁÁ•È¹É•Ý…É‘Ì¹ÙÈ¤¤°(€€€€€ÍÁ¥¸è5…Ñ ¹É½Õ¹¡¥¹Ñ•ÉÁ½±…Ñ”¡±½Ý•È¹É•Ý…É‘Ì¹ÍÁ¥¸°ÕÁÁ•È¹É•Ý…É‘Ì¹ÍÁ¥¸¤¤°(€€€ô°(€ôì)ô(