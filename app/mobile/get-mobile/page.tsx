"use client";

import { useEffect, useState } from "react";
import { Apple, CheckCircle2, Download, Smartphone, ShieldCheck, X } from "lucide-react";

type Device = "ios" | "android" | "other";

function detectDevice(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isPhone() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.matchMedia("(max-width: 699px)").matches;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function GetMobilePage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [device, setDevice] = useState<Device>("other");
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const phone = isPhone();
    setAllowed(phone && window.location.pathname.startsWith("/mobile/"));
    setDevice(detectDevice());
    setInstalled(isStandalone());
  }, []);

  if (allowed === false) {
    window.location.replace("/");
    return null;
  }

  if (allowed === null) return null;

  const isIOS = device === "ios";
  const isAndroid = device === "android";

  return (
    <>
      <div className="space-y-4 pb-8">
        <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/20 text-accent"><Download size={24} /></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Rhythians Mobile</p><h1 className="text-2xl font-bold">Get the app</h1></div>
          </div>
          <p className="text-sm leading-6 text-muted">Install Rhythians as a Progressive Web App. Once installed, it opens from your Home Screen as a standalone app instead of showing normal browser controls.</p>
        </section>

        {isIOS && (
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm leading-6 text-white shadow-lg">
            <strong>iPhone / iPad detected.</strong> The iOS installation option is highlighted below.
          </div>
        )}
        {isAndroid && (
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm leading-6 text-white shadow-lg">
            <strong>Android device detected.</strong> The Android installation option is highlighted below.
          </div>
        )}

        <section className={`rounded-3xl border p-5 transition-all ${isIOS ? "border-accent/60 bg-accent/[0.10] shadow-2xl ring-1 ring-accent/30 md:scale-[1.01]" : "border-white/10 bg-white/[0.035]"}`}>
          <div className="flex items-start gap-3">
            <Apple className="mt-0.5 shrink-0" size={22} />
            <div className="min-w-0 flex-1"><h2 className="font-bold">iPhone / iPad</h2><p className="mt-1 text-sm leading-6 text-muted">Use Safari's Add to Home Screen flow. After installation, launch Rhythians from its Home Screen icon to use standalone PWA mode.</p></div>
          </div>
          {installed && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200"><CheckCircle2 size={18} />Rhythians is already running in standalone app mode.</div>}
          <button type="button" onClick={() => setShowIosInstructions(true)} className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white ${isIOS ? "bg-accent shadow-lg" : "bg-white/10"}`}>{isIOS ? "Download iOS App" : "Show iOS install steps"}</button>
        </section>

        <section className={`rounded-3xl border p-5 transition-all ${isAndroid ? "border-accent/60 bg-accent/[0.10] shadow-2xl ring-1 ring-accent/30 md:scale-[1.01]" : "border-white/10 bg-white/[0.035]"}`}>
          <div className="flex items-start gap-3"><Smartphone className="mt-0.5 shrink-0" size={22} /><div><h2 className="font-bold">Android</h2><p className="mt-1 text-sm leading-6 text-muted">Rhythians is installable as a PWA. Chrome can provide an Install app action, and the installed app opens without normal browser UI.</p></div></div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-muted"><strong className="text-white">On Android:</strong> open Rhythians in Chrome → open the browser menu → choose <strong className="text-white">Install app</strong> (or <strong className="text-white">Add to Home screen</strong>) → confirm → launch the Rhythians icon from your launcher.</div>
          <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/10 p-4 text-xs leading-5 text-muted">The PWA starts at <code className="text-white">/mobile/</code>, so the installed app stays inside the mobile route and uses the same Rhythians account and backend.</div>
        </section>

        <section className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-xs leading-5 text-muted"><ShieldCheck className="shrink-0 text-emerald-300" size={19} />The installed app uses the official Rhythians mobile website and the same backend/account system. It is not a separate copy of the site.</section>
      </div>

      {showIosInstructions && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0f19] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">iOS installation</p><h2 id="ios-install-title" className="mt-1 text-xl font-bold">Add Rhythians to your Home Screen</h2></div>
              <button type="button" aria-label="Close" onClick={() => setShowIosInstructions(false)} className="rounded-full p-2 text-muted hover:bg-white/10 hover:text-white"><X size={20} /></button>
            </div>
            <ol className="mt-5 space-y-4 text-sm leading-6">
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent">1</span><span>Make sure this page is open in <strong>Safari</strong> on your iPhone or iPad.</span></li>
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent">2</span><span>Tap Safari's <strong>Share</strong> button.</span></li>
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent">3</span><span>Scroll down and tap <strong>Add to Home Screen</strong>.</span></li>
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent">4</span><span>Keep the name <strong>Rhythians</strong>, then tap <strong>Add</strong>.</span></li>
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent">5</span><span>Close Safari and open the new <strong>Rhythians</strong> icon from your Home Screen. It launches in standalone PWA mode without Safari's address bar or browser controls.</span></li>
            </ol>
            <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/10 p-4 text-xs leading-5 text-muted">iOS requires this one-time user confirmation. The installed icon launches the Rhythians mobile PWA at <code className="text-white">/mobile/</code>, not a normal Safari tab.</div>
            <button type="button" onClick={() => setShowIosInstructions(false)} className="mt-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
