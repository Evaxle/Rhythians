"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyMapId({ mapId }: { mapId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(mapId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return <button type="button" onClick={copy} title="Copy the map ID for use with /map <id>" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/40 hover:text-white">{copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}{copied ? "Copied!" : "Copy ID"}</button>;
}
