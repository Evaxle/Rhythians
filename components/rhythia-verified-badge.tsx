import { BadgeCheck } from "lucide-react";

export function RhythiaVerifiedBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "px-3 py-1 text-sm gap-1.5" : size === "sm" ? "px-2 py-0.5 text-[11px] gap-1" : "px-2.5 py-1 text-xs gap-1";
  const icon = size === "lg" ? 16 : size === "sm" ? 12 : 14;
  return (
    <span
      className={`inline-flex items-center rounded-full border border-accent/40 bg-accent/10 font-semibold text-accent ${sizeClass}`}
      title="Linked and verified Rhythia account"
    >
      <BadgeCheck size={icon} />
      Rhythia Verified
    </span>
  );
}