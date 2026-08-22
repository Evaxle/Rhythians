import { Tag as TagIcon } from "lucide-react";

interface UserTagsProps {
  tags: Array<{ tag: { name: string; slug: string } }>;
  size?: "sm" | "md" | "lg";
}

const TAG_COLORS: Record<string, string> = {
  beginner: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  intermediate: "bg-green-500/20 text-green-300 border-green-500/30",
  experienced: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  expert: "bg-red-500/20 text-red-300 border-red-500/30",
  "content-creator": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  veteran: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "rhythian-coach": "bg-accent/20 text-accent border-accent/30",
  tester: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "post-reviewer": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  mentor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  admin: "bg-amber-400/20 text-amber-300 border-amber-400/30",
  "camera-lock": "bg-slate-500/20 text-slate-300 border-slate-500/30",
  "camera-spin": "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "camera-vr": "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
  "map-reviewer": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  mapper: "bg-lime-500/20 text-lime-300 border-lime-500/30",
  developer: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  owner: "bg-amber-600/20 text-amber-400 border-amber-600/40",
};

const SEASON_RANK_COLORS: Record<string, string> = {
  copper: "bg-[#b87333]/20 text-[#d99a62] border-[#b87333]/40",
  bronze: "bg-[#cd7f32]/20 text-[#e3a35d] border-[#cd7f32]/40",
  silver: "bg-[#c0c0c0]/20 text-[#e5e5e5] border-[#c0c0c0]/40",
  gold: "bg-[#ffd700]/20 text-[#ffe55c] border-[#ffd700]/40",
  platinum: "bg-[#7fd4ff]/20 text-[#a8e4ff] border-[#7fd4ff]/40",
  emerald: "bg-[#50c878]/20 text-[#7be49b] border-[#50c878]/40",
  diamond: "bg-[#b9f2ff]/20 text-[#d8f8ff] border-[#b9f2ff]/40",
  master: "bg-[#a855f7]/20 text-[#c084fc] border-[#a855f7]/40",
  expert: "bg-[#f43f5e]/20 text-[#fb7185] border-[#f43f5e]/40",
};

function tagColor(slug: string) {
  if (TAG_COLORS[slug]) return TAG_COLORS[slug];
  const match = slug.match(/^season-\d+-(copper|bronze|silver|gold|platinum|emerald|diamond|master|expert)$/);
  return match ? SEASON_RANK_COLORS[match[1]] : "bg-white/5 text-muted border-border";
}

export function UserTags({ tags, size = "sm" }: UserTagsProps) {
  const visibleTags = tags.filter(({ tag }) => tag.slug !== "rhythian-coach").slice(0, 3);
  if (visibleTags.length === 0) return null;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  return <div className="flex flex-wrap gap-1.5">{visibleTags.map(({ tag }) => <span key={tag.slug} className={`inline-flex items-center gap-1 rounded-full border ${tagColor(tag.slug)} ${sizeClasses[size]}`}><TagIcon className="h-3 w-3" />{tag.name}</span>)}</div>;
}
