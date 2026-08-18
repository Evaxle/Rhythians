export const CAMERA_MODES = [
  { value: "lock", label: "Lock", emoji: "🔒" },
  { value: "spin", label: "Spin", emoji: "🌀" },
  { value: "vr", label: "VR", emoji: "🥽" },
] as const;

export type CameraModeValue = (typeof CAMERA_MODES)[number]["value"];

export function cameraModeLabel(mode: string | null | undefined) {
  const found = CAMERA_MODES.find((m) => m.value === mode);
  return found ? found.label : null;
}

export function cameraModeEmoji(mode: string | null | undefined) {
  const found = CAMERA_MODES.find((m) => m.value === mode);
  return found ? found.emoji : null;
}
