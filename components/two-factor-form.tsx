"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TwoFactorForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not verify the code.");
      router.replace(data.redirectTo ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="two-factor-code" className="mb-2 block text-sm font-medium text-white">Six-digit code</label>
        <input
          id="two-factor-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          pattern="[0-9]{6}"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="w-full rounded-2xl border border-border bg-background px-4 py-4 text-center text-3xl font-semibold tracking-[0.45em] text-white outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/30"
          aria-describedby={error ? "two-factor-error" : undefined}
        />
      </div>
      {error && <p id="two-factor-error" className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <button type="submit" disabled={busy || code.length !== 6} className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Verifying..." : "Verify and sign in"}
      </button>
      <p className="text-center text-xs leading-5 text-muted">The code expires after 10 minutes and can only be used once. After five incorrect attempts, you will need to sign in again.</p>
    </form>
  );
}
