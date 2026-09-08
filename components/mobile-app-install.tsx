"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Share2, Smartphone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function MobileAppInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua);
    setIsIos(ios);
    setIsSafari(ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua));

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const appInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const status = useMemo(() => {
    if (installed) return "Rhythians is installed on this device.";
    if (installPrompt) return "Your browser is ready to install Rhythians.";
    if (isIos) return isSafari ? "Install Rhythians from Safari using Add to Home Screen." : "Open this page in Safari to install Rhythians on iPhone or iPad.";
    return "If your browser supports web-app installation, its install option will appear here or in the browser menu.";
  }, [installed, installPrompt, isIos, isSafari]);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-accent/20 bg-accent/10 p-3 text-accent"><Smartphone size={24} /></div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">Mobile app status</p>
            <p className="mt-1 text-sm leading-6 text-muted">{status}</p>
          </div>
        </div>
      </div>

      {installed ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200"><CheckCircle2 size={18} /> Installed</div>
      ) : installPrompt ? (
        <button type="button" onClick={install} className="ui-button w-full justify-center bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent2"><Download size={18} /> Install Rhythians</button>
      ) : isIos ? (
        <div className="rounded-3xl border border-sky-400/20 bg-sky-400/[0.06] p-5">
          <p className="flex items-center gap-2 font-semibold text-white"><Share2 size={18} className="text-sky-300" /> Install on iPhone or iPad</p>
          <p className="mt-3 text-sm leading-6 text-muted">Open this page in Safari, tap the Share button, choose <span className="font-semibold text-white">Add to Home Screen</span>, then tap <span className="font-semibold text-white">Add</span>.</p>
        </div>
      ) : (
        <button type="button" disabled className="ui-button w-full cursor-not-allowed justify-center border border-white/10 bg-white/5 text-muted"><Download size={18} /> Install option not available yet</button>
      )}
    </div>
  );
}
