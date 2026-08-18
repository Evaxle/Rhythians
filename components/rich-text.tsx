"use client";

import Link from "next/link";
import { Film } from "lucide-react";

const TOKEN_REGEX = new RegExp(
  `\\/clip\\s+([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})|(?:https?:\\/\\/|www\\.)[^\\s<>"']+`,
  "gi"
);

type Token =
  | { type: "text"; value: string }
  | { type: "clip"; value: string; id: string }
  | { type: "url"; value: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_REGEX)) {
    const index = match.index as number;
    if (index < last) continue;
    if (index > last) {
      tokens.push({ type: "text", value: text.slice(last, index) });
    }
    if (match[1]) {
      tokens.push({ type: "clip", value: match[0], id: match[1] });
    } else {
      tokens.push({ type: "url", value: match[0] });
    }
    last = index + match[0].length;
  }
  if (last < text.length) {
    tokens.push({ type: "text", value: text.slice(last) });
  }
  return tokens;
}

export function RichText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const tokens = tokenize(text);

  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {tokens.map((token, index) => {
        if (token.type === "clip") {
          return (
            <Link
              key={index}
              href={`/clips/${token.id}`}
              className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent transition hover:bg-accent/20 hover:text-white"
              title={`Open clip ${token.id}`}
            >
              <Film size={11} />
              clip:{token.id.slice(0, 8)}
            </Link>
          );
        }
        if (token.type === "url") {
          return (
            <span key={index} className="text-muted" title="Off-site links are shown as plain text and are not clickable">
              {token.value}
            </span>
          );
        }
        return <span key={index}>{token.value}</span>;
      })}
    </p>
  );
}