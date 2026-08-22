"use client";

import { useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export function AccountSecurity({ email, emailVerifiedAt, emailTwoFactorEnabled }: { email: string | null; emailVerifiedAt: Date | null; emailTwoFactorEnabled: boolean }) {
  const [address, setAddress] = useState(email ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(Boolean(emailVerifiedAt));
  const [enabled, setEnabled] = useState(emailTwoFactorEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/account/email/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: address, password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not send the verification code.");
      setSent(true);
      setMessage("Verification code sent. Check your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/account/email/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not verify your email.");
      setVerified(true);
      setEnabled(true);
      setSent(false);
      setPassword("");
      setCode("");
      setMessage("Your email is verified and email 2FA is now enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify your email.");
    } finally {
      setBusy(false);
    }
  }

  if (enabled && verified && email) return <div className="rounded-2xl border border-green-400/20 bg-green-400/10 p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-green-300" /><div><p className="font-semibold text-white">Email 2FA is enabled</p><p className="mt-1 text-sm text-green-100/80">{email} is verified and will receive a security code when you sign in.</p></div></div></div>;

  return <div className="space-y-5"><div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5"><ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" /><div><p className="font-semibold text-white">Protect your account with email 2FA</p><p className="mt-1 text-sm leading-6 text-amber-100/80">Add and verify an email address. After verification, Rhythians will require a one-time code from that email whenever you sign in.</p></div></div>{!sent ? <form onSubmit={sendCode} className="space-y-4"><div><label htmlFor="security-email" className="mb-1.5 block text-sm font-medium text-white">Email address</label><input id="security-email" type="email" value={address} onChange={(event) => setAddress(event.target.value)} required autoComplete="email" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent" /></div><div><label htmlFor="security-password" className="mb-1.5 block text-sm font-medium text-white">Current password</label><input id="security-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent" /></div>{error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}{message && <p className="rounded-xl border border-green-400/20 bg-green-400/10 px-3 py-2 text-sm text-green-200">{message}</p>}<button type="submit" disabled={busy} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50">{busy ? "Sending..." : "Send verification code"}</button></form> : <form onSubmit={verifyCode} className="space-y-4"><div><label htmlFor="security-code" className="mb-1.5 block text-sm font-medium text-white">Verification code</label><input id="security-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-2xl tracking-[0.45em] text-white outline-none transition focus:border-accent" /></div>{error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}{message && <p className="rounded-xl border border-green-400/20 bg-green-400/10 px-3 py-2 text-sm text-green-200">{message}</p>}<button type="submit" disabled={busy || code.length !== 6} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50">{busy ? "Verifying..." : "Verify email and enable 2FA"}</button></form>}</div>;
}
