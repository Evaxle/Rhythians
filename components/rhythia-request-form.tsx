"use client";

import { useState } from "react";

export function RhythiaRequestForm() {
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(action: "start" | "check" | "manual") {
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/profile/rhythia/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, url, reason }) });
    const data = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(data?.error ?? "Something went wrong.");
      return;
    }
    if (data?.verification) {
      setCode(data.verification.code);
      setExpiresAt(data.verification.expiresAt);
      setMessage("Add this code to your Rhythia bio, then check the bio.");
    } else {
      setCode(null);
      setExpiresAt(null);
      setMessage(data?.message ?? "Request submitted.");
    }
  }

  return <div className="space-y-5">
    <div><label className="text-sm font-semibold text-white">Rhythia profile URL</label><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.rhythia.com/player/7564" className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white outline-none placeholder:text-muted focus:border-accent/50" /></div>
    {code && <div className="rounded-2xl border border-accent/30 bg-accent/10 p-5"><p className="text-xs uppercase tracking-[0.2em] text-accent">Verification code</p><p className="mt-2 text-3xl font-bold tracking-[0.25em] text-white">{code}</p><p className="mt-2 text-sm text-muted">Put the code in your Rhythia bio. It expires in 5 minutes.</p><button disabled={busy} onClick={() => submit("check")} className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Checking..." : "Check bio"}</button></div>}
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
    {message && !code && <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">{message}</div>}
    {!code && <div className="flex flex-wrap gap-3"><button disabled={busy || !url.trim()} onClick={() => submit("start")} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Working..." : "Start bio verification"}</button></div>}
    <div className="border-t border-border pt-5"><p className="text-sm font-semibold text-white">Can&apos;t verify through your bio?</p><p className="mt-1 text-sm leading-6 text-muted">Send the profile to the site admin for manual review instead.</p><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} placeholder="Optional: explain why the automatic check isn't working." className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white outline-none placeholder:text-muted focus:border-accent/50" /><button disabled={busy || !url.trim()} onClick={() => submit("manual")} className="mt-3 rounded-xl border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Request manual approval</button></div>
  </div>;
}
