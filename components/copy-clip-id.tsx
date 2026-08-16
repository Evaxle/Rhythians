"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyClipId({ clipId }: { clipId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(clipId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable; ignore silently.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy the clip ID so you can tag it in messages or comments with /clip <id>"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/40 hover:text-white"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      {copied ? "Copied!" : "Copy ID"}
    </button>
  );
}