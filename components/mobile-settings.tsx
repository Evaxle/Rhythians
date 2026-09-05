"use client";

import { useEffect, useState } from "react";
import { Smartphone, PanelLeft, PanelRight, Minimize2, UserRound, Zap } from "lucide-react";
import { usePathname } from "next/navigation";
import { DEFAULT_MOBILE_PREFERENCES, loadMobilePreferences, saveMobilePreferences, type MobilePreferences } from "@/lib/mobile-preferences";

export function MobileSettings() {
  const pathname = usePathname();
  const [prefs, setPrefs] = useState<MobilePreferences>(DEFAULT_MOBILE_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!pathname.startsWith("/mobile")) return;
    loadMobilePreferences().then((value) => {
      setPrefs(value);
      setLoaded(true);
    });
  }, [pathname]);

  if (!pathname.startsWith("/mobile") || !loaded) return null;

  const update = (patch: Partial<MobilePreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void saveMobilePreferences(next);
    window.dispatchEvent(new CustomEvent("rhythians-mobile-preferences", { detail: next }));
  };

  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent"><Smartphone size={21} /></div>
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Mobile only</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Mobile experience</h2>
          <p className="mt-2 text-sm leading-7 text-muted">Customize the mobile navigation and interaction style. These preferences are saved only on this device.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 border-t border-border pt-6">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-white">Side navigation position</span>
          <span className="text-xs leading-5 text-muted">Choose which edge holds the permanent mobile navigation.</span>
          <select value={prefs.navSide} onChange={(event) => update({ navSide: event.target.value as MobilePreferences["navSide"] })} className="w-full rounded-2xl border border-border bg-white/5 px-4 py-3 text-sm text-white">
            <option value="left">Left side</option>
            <option value="right">Right side</option>
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => update({ navSide: "left" })} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${prefs.navSide === "left" ? "border-accent/50 bg-accent/10" : "border-border bg-white/5"}`}>
            <PanelLeft size={19} className="shrink-0 text-accent" /><span><strong className="block text-sm text-white">Left navigation</strong><span className="text-xs text-muted">Keep the sidebar on the left edge of the screen.</span></span>
          </button>
          <button type="button" onClick={() => update({ navSide: "right" })} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${prefs.navSide === "right" ? "border-accent/50 bg-accent/10" : "border-border bg-white/5"}`}>
            <PanelRight size={19} className="shrink-0 text-accent" /><span><strong className="block text-sm text-white">Right navigation</strong><span className="text-xs text-muted">Move the sidebar to the opposite edge.</span></span>
          </button>
        </div>

        <Toggle icon={<Minimize2 size={18} />} title="Compact navigation" description="Use tighter navigation spacing to fit more destinations on smaller screens." checked={prefs.compactNav} onChange={(checked) => update({ compactNav: checked })} />
        <Toggle icon={<UserRound size={18} />} title="Show profile in top bar" description="Keep your account shortcut visible beside the search button." checked={prefs.showTopbarProfile} onChange={(checked) => update({ showTopbarProfile: checked })} />
        <Toggle icon={<Zap size={18} />} title="Reduce mobile motion" description="Reduce animated transitions for a calmer, faster-feeling interface." checked={prefs.reduceMotion} onChange={(checked) => update({ reduceMotion: checked })} />
      </div>
    </section>
  );
}

function Toggle({ icon, title, description, checked, onChange }: { icon: React.ReactNode; title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-white/[0.035] p-4">
      <span className="flex min-w-0 items-center gap-3"><span className="shrink-0 text-accent">{icon}</span><span><strong className="block text-sm text-white">{title}</strong><span className="mt-1 block text-xs leading-5 text-muted">{description}</span></span></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--page-accent)]" />
    </label>
  );
}
