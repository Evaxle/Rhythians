"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  DEFAULT_RHYTHIAN_BROWSER_SETTINGS,
  RHYTHIAN_BROWSER_SETTINGS_KEY,
  sanitizeRhythianBrowserSettings,
  type RhythianBrowserSettings,
} from "@/lib/rhythian-browser-settings";

const modifiers: Array<{ key: keyof RhythianBrowserSettings; label: string; description: string }> = [
  { key: "noFail", label: "No Fail", description: "Keep playing after health reaches zero." },
  { key: "suddenDeath", label: "Sudden Death", description: "End the run on the first miss." },
  { key: "hardMode", label: "Hard", description: "Use the client's harder timing and presentation." },
  { key: "easyMode", label: "Easy", description: "Use the client's easier timing and presentation." },
  { key: "hardRock", label: "Hard Rock", description: "Tighten hit timing and increase visual pressure." },
  { key: "mirrorX", label: "Mirror X", description: "Mirror map positions horizontally." },
  { key: "mirrorY", label: "Mirror Y", description: "Mirror map positions vertically." },
  { key: "nearsight", label: "Nearsight", description: "Reduce how early upcoming notes are visible." },
  { key: "ghost", label: "Ghost", description: "Fade notes as they approach their hit time." },
  { key: "chaos", label: "Chaos", description: "Apply the client-style animated playfield offset." },
  { key: "earthquake", label: "Earthquake", description: "Shake the playfield during gameplay." },
  { key: "flashlight", label: "Flashlight", description: "Restrict visibility around the cursor." },
  { key: "visualMode", label: "Visual Mode", description: "Practice without submitting a score." },
  { key: "invertMouse", label: "Invert Mouse", description: "Invert pointer movement inside the playfield." },
];

function Slider({ label, value, min, max, step, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="block rounded-2xl border border-white/10 bg-black/15 p-4"><span className="flex items-center justify-between gap-4 text-sm font-semibold text-white"><span>{label}</span><span className="font-mono text-xs text-accent">{Math.round(value * (suffix === "%" ? 100 : 1) * 100) / 100}{suffix}</span></span><input className="mt-3 w-full accent-[var(--accent)]" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function RhythianClientSettings() {
  const [settings, setSettings] = useState<RhythianBrowserSettings>(DEFAULT_RHYTHIAN_BROWSER_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RHYTHIAN_BROWSER_SETTINGS_KEY);
      setSettings(sanitizeRhythianBrowserSettings(raw ? JSON.parse(raw) : null));
    } catch {
      setSettings(DEFAULT_RHYTHIAN_BROWSER_SETTINGS);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(RHYTHIAN_BROWSER_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent("rhythian-browser-settings", { detail: settings }));
  }, [settings, loaded]);

  const set = <K extends keyof RhythianBrowserSettings>(key: K, value: RhythianBrowserSettings[K]) => setSettings((current) => sanitizeRhythianBrowserSettings({ ...current, [key]: value }));

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="ui-eyebrow">Rhythian Client</p><h2 className="mt-2 text-2xl font-semibold text-white">Gameplay settings</h2><p className="mt-2 text-sm leading-6 text-muted">These settings mirror the desktop client controls and are used directly by browser gameplay.</p></div><button type="button" onClick={() => setSettings(DEFAULT_RHYTHIAN_BROWSER_SETTINGS)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white hover:bg-white/[0.09]"><RotateCcw size={15} /> Reset</button></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Slider label="Master volume" value={settings.masterVolume} min={0} max={1} step={0.01} suffix="%" onChange={(value) => set("masterVolume", value)} />
      <Slider label="Music volume" value={settings.musicVolume} min={0} max={1} step={0.01} suffix="%" onChange={(value) => set("musicVolume", value)} />
      <Slider label="Hit sound volume" value={settings.hitSoundVolume} min={0} max={1} step={0.01} suffix="%" onChange={(value) => set("hitSoundVolume", value)} />
      <Slider label="Global offset" value={settings.globalOffsetMs} min={-500} max={500} step={1} suffix=" ms" onChange={(value) => set("globalOffsetMs", value)} />
      <Slider label="Cursor scale" value={settings.cursorScale} min={0.4} max={2.5} step={0.05} onChange={(value) => set("cursorScale", value)} />
      <Slider label="Background dim" value={settings.backgroundDim} min={0} max={0.95} step={0.01} suffix="%" onChange={(value) => set("backgroundDim", value)} />
      <Slider label="Note scale" value={settings.noteScale} min={0.55} max={1.8} step={0.05} onChange={(value) => set("noteScale", value)} />
      <Slider label="Approach time" value={settings.approachMs} min={250} max={1800} step={10} suffix=" ms" onChange={(value) => set("approachMs", value)} />
      <Slider label="Custom speed" value={settings.speed} min={0.5} max={2} step={0.05} onChange={(value) => set("speed", value)} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{modifiers.map((modifier) => {
      const active = Boolean(settings[modifier.key]);
      return <button key={modifier.key} type="button" onClick={() => set(modifier.key, !active as never)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-accent/50 bg-accent/12" : "border-white/10 bg-black/15 hover:bg-white/[0.05]"}`}><span className="flex items-center justify-between gap-3"><span className="font-semibold text-white">{modifier.label}</span><span className={`h-3 w-3 rounded-full ${active ? "bg-accent shadow-[0_0_14px_currentColor]" : "bg-white/20"}`} /></span><span className="mt-2 block text-xs leading-5 text-muted">{modifier.description}</span></button>;
    })}</div>
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/15 p-4"><span><span className="block font-semibold text-white">Cursor trail</span><span className="mt-1 block text-xs text-muted">Show the Rhythia-style cursor trail during gameplay.</span></span><input type="checkbox" checked={settings.cursorTrail} onChange={(event) => set("cursorTrail", event.target.checked)} className="h-5 w-5 accent-[var(--accent)]" /></label>
  </div>;
}
