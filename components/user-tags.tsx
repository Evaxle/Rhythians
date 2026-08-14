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
};

export function UserTags({ tags, size = "sm" }: UserTagsProps) {
  if (tags.length === 0) return null;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(({ tag }) => (
        <span
          key={tag.slug}
          className={`inline-flex items-center gap-1 rounded-full border ${TAG_COLORS[tag.slug] || "bg-white/5 text-muted border-border"} ${sizeClasses[size]}`}
        >
          <TagIcon className="h-3 w-3" />
          {tag.name}
        </span>
      ))}
    </div>
  );
}
