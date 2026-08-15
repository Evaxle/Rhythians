"use client";

import { useState } from "react";
import { PatternGrid } from "@/components/knowledge/pattern-grid";
import type { KnowledgePattern } from "@/lib/knowledge";

export function PatternViewer({ pattern }: { pattern: KnowledgePattern }) {
  const [variantIndex, setVariantIndex] = useState(-1);

  const activeVariant = variantIndex >= 0 ? pattern.variants[variantIndex] : null;
  const grid = activeVariant?.grid ?? pattern.grid;
  const name = activeVariant ? `${pattern.name} — ${activeVariant.name}` : pattern.name;

  return (
    <div className="w-full">
      <PatternGrid grid={grid} gridName={name} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setVariantIndex(-1)}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
            variantIndex === -1
              ? "bg-accent text-white"
              : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"
          }`}
        >
          {pattern.name}
        </button>
        {pattern.variants.map((variant, index) => (
          <button
            key={variant.name}
            type="button"
            onClick={() => setVariantIndex(index)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              variantIndex === index
                ? "bg-accent text-white"
                : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"
            }`}
          >
            {variant.name}
          </button>
        ))}
      </div>
    </div>
  );
}
