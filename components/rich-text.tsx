"use client";

import Link from "next/link";
import { Film, Map as MapIcon } from "lucide-react";
import { useEffect, useState } from "react";

const TOKEN_REGEX = new RegExp(
  `\\/clip\\s+([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})|\\/map\\s+([0-9a-zA-Z-]+)|(?:https?:\\/\\/|www\\.)[^\\s<>"']+`,
  "gi"
);

type Token =
  | { type: "text"; value: string }
  | { type: "clip"; value: string; id: string }
  | { type: "map"; value: string; id: string }
  | { type: "url"; value: string };

type MapMeta = { id: string; title: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_REGEX)) {
    const index = match.index as number;
    if (index < last) continue;
    if (index > last) tokens.push({ type: "text", value: text.slice(last, index) });
    if (match[1]) tokens.push({ type: "clip", value: match[0], id: match[1] });
    else if (match[2]) tokens.push({ type: "map", value: match[0], id: match[2] });
    else tokens.push({ type: "url", value: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

export function RichText({ text, content, className = "" }: { text?: string; content?: string; className?: string }) {
  const tokens = tokenize(content ?? text ?? "");
  const mapIds = [...new Set(tokens.filter((token): token is Extract<Token, { type: "map" }> => token.type === "map").map((token) => token.id))];
  const [maps, setMaps] = useState<Record<string, MapMeta>>({});

  useEffect(() => {
    let cancelled = false;
    if (mapIds.length === 0) return;
    Promise.all(mapIds.map(async (id) => {
      try {
        const response = await fetch(`/api/maps/tag/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok) return null;
        return await response.json() as MapMeta;
      } catch {
        return null;
      }
    })).then((results) => {
      if (cancelled) return;
      setMaps((current) => {
        const next = { ...current };
        for (const result of results) if (result) next[result.id] = result;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [mapIds.join("|")]);

  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {tokens.map((token, index) => {
        if (token.type === "clip") {
          return <Link key={index} href={`/clips/${token.id}`} className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent transition hover:bg-accent/20 hover:text-white" title={`Open clip ${token.id}`}><Film size={11} /> clip:{token.id.slice(0, 8)}</Link>;
        }
        if (token.type === "map") {
          const map = maps[token.id];
          return <Link key={index} href={`/maps/${encodeURIComponent(map?.id ?? token.id)}`} className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-400/20 hover:text-white" title={`Open map ${map?.title ?? token.id}`}><MapIcon size={11} /> {map?.title ?? `map:${token.id.slice(0, 8)}`}</Link>;
        }
        if (token.type === "url") return <span key={index} className="text-muted" title="Off-site links are shown as plain text and are not clickable">{token.value}</span>;
        return <span key={index}>{token.value}</span>;
      })}
    </p>
  );
}