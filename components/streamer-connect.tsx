"use client";

import { useState } from "react";
import { ExternalLink, Link2, Radio, Unlink } from "lucide-react";

type Platform = "twitch" | "tiktok";

export function StreamerConnect({ initialAccounts = [] }: { initialAccounts?: any[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [open, setOpen] = useState<Platform | null>(null);
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function call(platform: Platform, action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/profile/streaming", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform, action, ...extra }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Account update failed.");
      if (action === "start") { setCode(data.code); setMessage(`Put ${data.code} anywhere in your ${platform === "twitch" ? "Twitch" : "TikTok"} bio, then press Check bio.`); }
      if (action === "check") { setMessage("Account verified."); window.setTimeout(() => window.location.reload(), 500); }
      if (action === "unlink") { setAccounts((current: any[]) => current.filter((account) => account.platform !== platform)); setMessage("Account unlinked."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account update failed."); }
    finally { setBusy(false); }
  }

  return <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 p-4">
    <div className="flex items-center gap-2"><Radio size={15} className="text-rose-300" /><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Streamer accounts</p></div>
    <div className="mt-3 flex flex-wrap gap-2">{(["twitch","tiktok"] as Platform[]).map((platform) => {
      const account = accounts.find((item: any) => item.platform === platform && item.verified);
      return account ? <div key={platform} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"><a href={account.profileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 capitalize"><ExternalLink size={13} />{platform} @{account.username}</a><button onClick={() => void call(platform,"unlink")} title={`Unlink ${platform}`} className="text-muted hover:text-rose-300"><Unlink size={13} /></button></div> : <button key={platform} onClick={() => { setOpen(platform); setUrl(""); setCode(""); setMessage(""); }} className="ui-button border border-white/10 bg-white/5 text-white"><Link2 size={14} /> Link <span className="capitalize">{platform}</span></button>;
    })}</div>
    {open && !accounts.some((item: any) => item.platform === open && item.verified) && <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-sm font-semibold capitalize text-white">Link {open}</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={open === "twitch" ? "https://twitch.tv/username" : "https://www.tiktok.com/@username"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-white" /><button disabled={busy || !url.trim()} onClick={() => void call(open,"start",{url})} className="ui-button bg-accent text-white disabled:opacity-50">Generate code</button></div>{code && <div className="mt-3 flex items-center gap-3"><span className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-2 font-mono text-lg font-bold tracking-[0.2em] text-white">{code}</span><button disabled={busy} onClick={() => void call(open,"check")} className="ui-button border border-white/10 bg-white/5 text-white">Check bio</button></div>}</div>}
    {message && <p className="mt-3 text-xs leading-5 text-muted">{message}</p>}
  </div>;
}
