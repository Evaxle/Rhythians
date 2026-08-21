"use client";

import { useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";

const STORAGE_KEY = "rhythians_cursor_prefs";
const PREFS_EVENT = "rhythians:cursor-prefs";

type Prefs = { enabled: boolean; trail: boolean };

export function CursorSettings() {
  const [prefs, setPrefs] = useState<Prefs>({ enabled: false, trail: true });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefs({ enabled: Boolean(parsed.enabled), trail: parsed.trail !== false });
      }
    } catch {}
    setMounted(true);
  }, []);

  const update = (next: Partial<Prefs>) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {}
    window.dispatchEvent(new CustomEvent<Prefs>(PREFS_EVENT, { detail: merged }));
  };

  const toggleSwitch = (checked: boolean, onChange: () => void) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-accent" : "bg-border"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <MousePointer2 size={18} />
          </div>
          <div>
            <p className="font-semibold text-white">Custom cursor</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Replace the default cursor with a glowing Rhythia-style cursor. It is saved on this device only.
            </p>
          </div>
        </div>
        {toggleSwitch(prefs.enabled, () => update({ enabled: !prefs.enabled }))}
      </div>

      <div
        className={`flex items-start justify-between gap-4 transition-opacity ${prefs.enabled && mounted ? "opacity-100" : "opacity-40"}`}
      >
        <div>
          <p className="font-semibold text-white">Cursor trail</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Add a trailing ribbon of dots that follows the cursor.
          </p>
        </div>
        {toggleSwitch(prefs.trail, () => update({ trail: !prefs.trail }))}
      </div>
    </div>
  );
}