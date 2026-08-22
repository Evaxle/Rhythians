"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VerifyTwoFactorForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not verify the code.");
      router.push(data.redirectTo ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa/resend", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not send a new code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a new code.");
    } finally {
      setResending(false);
    }
  }

  return <div className="space-y-4"><form onSubmit={verify} className="space-y-4"><div><label htmlFor="mfa-code" className="mb-1.5 block text-sm font-medium text-white">Security code</label><input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-2xl tracking-[0.45em] text-white outline-none transition focus:border-accent" /></div>{error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}<button type="submit" disabled={busy || code.length !== 6} className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50">{busy ? "Verifying..." : "Verify and sign in"}</button></form><button type="button" onClick={resend} disabled={resending} className="w-full rounded-full border border-border px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:opacity-50">{resending ? "Sending..." : "Send a new code"}</button></div>;
}
