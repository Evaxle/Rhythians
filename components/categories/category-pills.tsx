"use client";

import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/category-constants";

export function CategoryPills({
  selected,
  onSelect,
}: {
  selected: Category;
  onSelect: (category: Category) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onSelect(category)}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
            selected === category
              ? "border-accent/60 bg-accent/20 text-white"
              : "border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"
          }`}
        >
          {CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  );
}
