"use client";

import { useEffect, useState } from "react";
import { Apple, Download, Smartphone, ShieldCheck } from "lucide-react";

function isPhone() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.matchMedia("(max-width: 699px)").matches;
}

export default function GetMobilePage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const phone = isPhone();
    setAllowed(phone && window.location.pathname.startsWith("/mobile/"));
    setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  if (allowed === false) {
    window.location.replace("/");
    return null;
  }

  if (allowed === null) return null;

  return (
    <div className="space-y-4 pb-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/20 text-accent"><Download size={24} /></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Rhythians Mobile</p><h1 className="text-2xl font-bold">Get the app</h1></div>
        </div>
        <p className="text-sm leading-6 text-muted">Install the Rhythians mobile experience so it opens like an app, uses the full phone screen, and keeps the mobile version of the site available from your home screen.</p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-start gap-3">
          <Apple className="mt-0.5 shrink-0" size={22} />
          <div className="min-w-0 flex-1"><h2 className="font-bold">iPhone / iPad</h2><p className="mt-1 text-sm leading-6 text-muted">Rhythians uses the iOS PWA system. Safari does not allow a website to silently install an app, so confirm the browser prompt and use Add to Home Screen. The installed web app opens in standalone mode at the mobile version.</p></div>
        </div>
        <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/10 p-4 text-sm leading-6 text-white"><strong>On iOS:</strong> tap Safari's Share button → <strong>Add to Home Screen</strong> → Add. Open the new Rhythians icon from your Home Screen.</div>
        <button type="button" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })} className="mt-4 w-full rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-white">{ios ? "Show iPhone install steps" : "Show iOS install steps"}</button>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-start gap-3"><Smartphone className="mt-0.5 shrink-0" size={22} /><div><h2 className="font-bold">Android</h2><p className="mt-1 text-sm leading-6 text-muted">The Android package is planned as an APK containing the same mobile web experience.</p></div></div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-muted">APK download is not published yet. This button will be replaced with the signed APK once an Android build is available.</div>
        <button disabled className="mt-4 w-full cursor-not-allowed rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-muted">Android APK — coming soon</button>
      </section>

      <section className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-xs leading-5 text-muted"><ShieldCheck className="shrink-0 text-emerald-300" size={19} />The installed iOS version is the Rhythians website running from the official mobile PWA origin; it does not require a separate account or backend.</section>
    </div>
  );
}
