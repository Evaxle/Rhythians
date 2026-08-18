"use client";

import { useState } from "react";

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface UserTagsManagerProps {
  userId: string;
  currentTags: Tag[];
  allTags: Tag[];
}

export function UserTagsManager({ userId, currentTags, allTags }: UserTagsManagerProps) {
  const [selectedTags, setSelectedTags] = useState<Tag[]>(currentTags);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const toggleTag = (tag: Tag) => {
    const isSelected = selectedTags.some((t) => t.id === tag.id);
    if (isSelected) {
      setSelectedTags(selectedTags.filter((t) => t.id !== tag.id));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: selectedTags.map((t) => t.id) }),
      });

      if (!response.ok) {
        throw new Error("Failed to update tags");
      }

      setHasChanges(false);
    } catch (error) {
      console.error("Error updating tags:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {allTags.map((tag) => {
          const isSelected = selectedTags.some((t) => t.id === tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                isSelected
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-border bg-background/50 text-muted hover:border-accent/50 hover:text-white"
              }`}
            >
              {tag.name}
            </button>
          );
        })}
      </div>
      {hasChanges && (
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      )}
    </div>
  );
}
