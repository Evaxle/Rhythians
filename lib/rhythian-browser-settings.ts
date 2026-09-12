export type RhythianBrowserSettings = {
  masterVolume: number;
  musicVolume: number;
  hitSoundVolume: number;
  globalOffsetMs: number;
  cursorScale: number;
  cursorTrail: boolean;
  invertMouse: boolean;
  backgroundDim: number;
  noteScale: number;
  approachMs: number;
  speed: number;
  noFail: boolean;
  suddenDeath: boolean;
  hardMode: boolean;
  easyMode: boolean;
  hardRock: boolean;
  mirrorX: boolean;
  mirrorY: boolean;
  nearsight: boolean;
  ghost: boolean;
  chaos: boolean;
  earthquake: boolean;
  flashlight: boolean;
  visualMode: boolean;
};

export const RHYTHIAN_BROWSER_SETTINGS_KEY = "rhythians:browser-client-settings:v1";

export const DEFAULT_RHYTHIAN_BROWSER_SETTINGS: RhythianBrowserSettings = {
  masterVolume: 1,
  musicVolume: 0.8,
  hitSoundVolume: 0.8,
  globalOffsetMs: 0,
  cursorScale: 1,
  cursorTrail: true,
  invertMouse: false,
  backgroundDim: 0.48,
  noteScale: 1,
  approachMs: 850,
  speed: 1,
  noFail: false,
  suddenDeath: false,
  hardMode: false,
  easyMode: false,
  hardRock: false,
  mirrorX: false,
  mirrorY: false,
  nearsight: false,
  ghost: false,
  chaos: false,
  earthquake: false,
  flashlight: false,
  visualMode: false,
};

export function sanitizeRhythianBrowserSettings(value: Partial<RhythianBrowserSettings> | null | undefined): RhythianBrowserSettings {
  const source = value ?? {};
  const number = (key: keyof RhythianBrowserSettings, min: number, max: number) => {
    const next = Number(source[key]);
    const fallback = Number(DEFAULT_RHYTHIAN_BROWSER_SETTINGS[key]);
    return Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : fallback;
  };
  const bool = (key: keyof RhythianBrowserSettings) => typeof source[key] === "boolean" ? Boolean(source[key]) : Boolean(DEFAULT_RHYTHIAN_BROWSER_SETTINGS[key]);
  return {
    masterVolume: number("masterVolume", 0, 1),
    musicVolume: number("musicVolume", 0, 1),
    hitSoundVolume: number("hitSoundVolume", 0, 1),
    globalOffsetMs: number("globalOffsetMs", -500, 500),
    cursorScale: number("cursorScale", 0.4, 2.5),
    cursorTrail: bool("cursorTrail"),
    invertMouse: bool("invertMouse"),
    backgroundDim: number("backgroundDim", 0, 0.95),
    noteScale: number("noteScale", 0.55, 1.8),
    approachMs: number("approachMs", 250, 1800),
    speed: number("speed", 0.5, 2),
    noFail: bool("noFail"),
    suddenDeath: bool("suddenDeath"),
    hardMode: bool("hardMode"),
    easyMode: bool("easyMode"),
    hardRock: bool("hardRock"),
    mirrorX: bool("mirrorX"),
    mirrorY: bool("mirrorY"),
    nearsight: bool("nearsight"),
    ghost: bool("ghost"),
    chaos: bool("chaos"),
    earthquake: bool("earthquake"),
    flashlight: bool("flashlight"),
    visualMode: bool("visualMode"),
  };
}
