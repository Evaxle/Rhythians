"use client";

import { useState } from "react";
import { AlertTriangle, Link2, RefreshCw, Send } from "lucide-react";

type Mismatch = { profileId: number; profileUrl: string; username: string | null };

export function RhythiaConnect({ connectedUrl }: { connectedUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(connectedUrl ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [mismatch, setMismatch] = useState<Mismatch | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMismatch(null);
    try {
      const response = await fetch("/api/profile/rhythia", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await response.json();
      if (data.mismatch) {
        setMismatch(data.candidate);
        setError("The name on that Rhythia profile doesn't match your account.");
      } else if (!response.ok) setError(data.error ?? "Unable to connect that profile.");
      else window.location.reload();
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest() {
    setRequesting(true);
    setError("");
    try {
      const response = await fetch("/api/profile/rhythia/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await response.json();
      if (data.profile) window.location.reload();
      else if (data.alreadyRequested) setError("You already have a pending request that an admin needs to review.");
      else if (!response.ok) setError(data.error ?? "Unable to send the request.");
      else {
        setMismatch(null);
        setRequestSent(true);
      }
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/20">
        {connectedUrl ? <RefreshCw size={16} /> : <Link2 size={16} />} {connectedUrl ? "Refresh Rhythia" : "Link Rhythia account"}
      </button>
      {open && (
        <div className="mt-3 rounded-2xl border border-border bg-background/80 p-4">
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-5 text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Using a different profile other than your own will get your account suspended or checked out.</p>
          </div>

          <form onSubmit={submit} className="mt-3">
            <label htmlFor="rhythia-url" className="text-xs uppercase tracking-[0.18em] text-muted">Rhythia profile URL</label>
            <input id="rhythia-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.rhythia.com/player/7564" className="mt-2 w-full rounded-xl border border-border bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent" />
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

            {mismatch ? (
              <div className="mt-3 rounded-xl border border-border bg-background/70 p-3">
                <p className="text-xs leading-5 text-muted">
                  This profile belongs to <span className="font-semibold text-white">{mismatch.username ?? "another player"}</span>.
                  Send a request to an admin to review and approve the link if it really is yours.
                </p>
                <button type="button" onClick={sendRequest} disabled={requesting} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-accent/20 disabled:opacity-60">
                  <Send size={15} /> {requesting ? "Sending..." : "Send profile link request"}
                </button>
              </div>
            ) : (
              <button disabled={busy} className="mt-3 w-full rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Loading..." : "Submit"}</button>
            )}
          </form>

          {requestSent && (
            <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs leading-5 text-emerald-200">
              Request sent. An admin will review it and approve or deny it with a message. You&apos;ll get a notification once it&apos;s been handled.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
