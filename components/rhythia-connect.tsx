"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Link2, RefreshCw, ShieldCheck } from "lucide-react";

export function RhythiaConnect({ connectedUrl }: { connectedUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(connectedUrl ?? "");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  async function startVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile/rhythia/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", url }) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Unable to start verification.");
        return;
      }
      setCode(data.verification.code);
      setExpiresAt(data.verification.expiresAt);
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function checkBio() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile/rhythia/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "check", code }) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The code could not be verified.");
        if (response.status === 410) {
          setCode("");
          setExpiresAt(null);
        }
        return;
      }
      setMessage(data.message ?? "Your Rhythia account is verified. You can remove the code from your bio now.");
      window.setTimeout(() => window.location.reload(), 1800);
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");

  if (connectedUrl) {
    return <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/20"><RefreshCw size={16} /> Refresh Rhythia</button>;
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/20"><Link2 size={16} /> Verify Rhythia account</button>
      {open && (
        <div className="mt-3 rounded-2xl border border-border bg-background/80 p-4">
          {!code ? (
            <form onSubmit={startVerification}>
              <div className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs leading-5 text-muted"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><p>Enter your Rhythia profile URL. We&apos;ll give you a one-time 8-digit code that expires after 5 minutes.</p></div>
              <label htmlFor="rhythia-url" className="mt-3 block text-xs uppercase tracking-[0.18em] text-muted">Rhythia profile URL</label>
              <input id="rhythia-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.rhythia.com/player/7564" className="mt-2 w-full rounded-xl border border-border bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent" />
              {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
              <button disabled={busy} className="mt-3 w-full rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Checking profile..." : "Submit profile"}</button>
            </form>
          ) : (
            <div>
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center"><p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Your verification code</p><p className="mt-2 text-3xl font-black tracking-[0.35em] text-white">{code}</p><p className="mt-2 text-xs text-emerald-200">Expires in {minutes}:{seconds}</p></div>
              <p className="mt-3 text-sm leading-6 text-muted">Copy the exact code into your Rhythia profile bio. You can keep the rest of your bio; the verifier checks the entire bio for this code. Save your Rhythia profile, then come back here and press <span className="font-semibold text-white">Check bio</span>.</p>
              {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
              {message && <p className="mt-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs leading-5 text-emerald-200">{message}</p>}
              <button type="button" onClick={checkBio} disabled={busy || remaining === 0} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Checking bio..." : <><CheckCircle2 size={15} /> Check bio</>}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
