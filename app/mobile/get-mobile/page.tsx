"use client";

import { useEffect, useState } from "react";
import { Apple, CheckCircle2, Download, Smartphone, ShieldCheck, X } from "lucide-react";

function isPhone() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.matchMedia("(max-width: 699px)").matches;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function GetMobilePage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [ios, setIos] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const phone = isPhone();
    setAllowed(phone && window.location.pathname.startsWith("/mobile/"));
    setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
    setInstalled(isStandalone());
  }, []);

  if (allowed === false) {
    window.location.replace("/");
    return null;
  }

  if (allowed === null) return null;

  return (
    <>
      <div className="space-y-4 pb-8">
        <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/20 text-accent"><Download size={24} /></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Rhythians Mobile</p><h1 className="text-2xl font-bold">Get the app</h1></div>
          </div>
          <p className="text-sm leading-6 text-muted">Install Rhythians as a Progressive Web App (PWA). Once installed, it opens from your Home Screen as a standalone app instead of showing Safari's normal browser controls.</p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-start gap-3">
            <Apple className="mt-0.5 shrink-0" size={22} />
            <div className="min-w-0 flex-1"><h2 className="font-bold">iPhone / iPad</h2><p className="mt-1 text-sm leading-6 text-muted">iOS does not let a website silently install a PWA. The official iOS flow is to use Safari's Add to Home Screen action, then launch Rhythians from the new Home Screen icon.</p></div>
          </div>
          {installed && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200"><CheckCircle2 size={18} />Rhythians is already running in standalone app mode.</div>}
          <button type="button" onClick={() => setShowIosInstructions(true)} className="mt-4 w-full rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-white">{ios ? "Download iOS App" : "Show iOS install steps"}</button>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-start gap-3"><Smartphone className="mt-0.5 shrink-0" size={22} /><div><h2 className="font-bold">Android</h2><p className="mt-1 text-sm leading-6 text-muted">Android can install the same mobile website as a PWA. Chrome can offer an Install App prompt, and the installed app opens without the normal browser UI.</p></div></div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-muted"><strong className="text-white">For Android:</strong> open Rhythians in Chrome, use Chrome's menu → <strong className="text-white">Install app</strong> (or <strong className="text-white">Add to Home screen</strong>), then launch the Rhythians icon from the Android launcher.</div>
          <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/10 p-4 text-xs leading-5 text-muted">The current Rhythians PWA manifest and service worker are already set up for the <code className="text-white">/mobile</code> app. No separate Android website is required.</div>
        </section>

        <section className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-xs leading-5 text-muted"><ShieldCheck className="shrink-0 text-emerald-300" size={19} />The installed app uses the official Rhythians mobile website and the same backend/account system. It is not a separate copy of the site.</section>
      </div>

      {showIosInstructions && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0f19] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">iOS installation</p>
                <h2 id="ios-install-title" className="mt-1 text-xl font-bold">Add Rhythians to your Home Screen</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setShowIosInstructions(false)} className="rounded-full p-2 text-muted hover:bg-white/10 hover:text-white"><X size={20} /></button>
            </div>

            <ol className="mt-5 space-y-4 text-sm leading-6">
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent">1</span><span>Make sure this page is open in <strong>Safari</strong> on your iPhone or iPad.</span></li>
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent">2</span><span>Tap Safari's <strong>Share</strong> button.</span></li>
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent">3</span><span>Scroll down and tap <strong>Add to Home Screen</strong>.</span></li>
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent">4</span><span>Keep the name <strong>Rhythians</strong>, then tap <strong>Add</strong>.</span></li>
              <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent">5</span><span>Close Safari and open the new <strong>Rhythians</strong> icon from your Home Screen. It will launch in standalone PWA mode with no Safari address bar or browser controls.</span></li>
            </ol>

            <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/10 p-4 text-xs leading-5 text-muted">Important: the website cannot press Apple's install button for you. This one-time confirmation is required by iOS. After you add the icon, launching that icon opens the mobile Rhythians app shell rather than a normal Safari tab.</div>
            <button type="button" onClick={() => setShowIosInstructions(false)} className="mt-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
