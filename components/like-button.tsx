"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

interface LikeButtonProps {
  clipId: string;
  initialLikes: number;
  isLiked: boolean;
  isAuthenticated: boolean;
}

export function LikeButton({ clipId, initialLikes, isLiked: initialIsLiked, isAuthenticated }: LikeButtonProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isLoading, setIsLoading] = useState(false);

  const handleLike = async () => {
    if (!isAuthenticated || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/like`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to toggle like");
      }

      const data = await response.json();
      setIsLiked(data.liked);
      setLikes(data.likeCount);
    } catch (error) {
      console.error("Error toggling like:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={!isAuthenticated || isLoading}
      className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
        isLiked
          ? "border-red-500/50 bg-red-500/20 text-red-300"
          : "border-border bg-background/50 text-muted hover:border-accent hover:text-white"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <Heart
        className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`}
      />
      <span>{likes}</span>
    </button>
  );
}
