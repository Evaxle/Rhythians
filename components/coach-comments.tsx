"use client";

import { useState } from "react";
import { UserTags } from "@/components/user-tags";
import { RichText } from "@/components/rich-text";

interface CoachComment {
  id: string;
  text: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string | null;
    userTags: Array<{ tag: { name: string; slug: string } }>;
  };
}

interface CoachCommentsProps {
  clipId: string;
  comments: CoachComment[];
  isCoach: boolean;
  isAuthenticated: boolean;
}

export function CoachComments({ clipId, comments: initialComments, isCoach, isAuthenticated }: CoachCommentsProps) {
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/coach-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment }),
      });

      if (!response.ok) {
        throw new Error("Failed to post comment");
      }

      const data = await response.json();
      setComments([data.comment, ...comments]);
      setNewComment("");
    } catch (error) {
      console.error("Error posting comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Coach Comments</h3>

      {isAuthenticated && isCoach && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your coaching insights..."
            className="w-full rounded-lg border border-border bg-background/50 p-3 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
            rows={3}
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
          >
            {isSubmitting ? "Posting..." : "Post Comment"}
          </button>
        </form>
      )}

      {isAuthenticated && !isCoach && (
        <p className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
          Only Rhythian Coaches can post comments in this section.
        </p>
      )}

      {!isAuthenticated && (
        <p className="rounded-lg border border-border bg-background/50 p-3 text-sm text-muted">
          Log in to see coach comments.
        </p>
      )}

      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-muted">No coach comments yet.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-accent/20 bg-accent/5 p-4">
              <div className="flex items-start gap-3">
                {comment.author.avatar ? (
                  <img
                    src={comment.author.avatar.startsWith("http")
                      ? comment.author.avatar
                      : `https://cdn.discordapp.com/avatars/${comment.author.id}/${comment.author.avatar}.png?size=64`}
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                    {comment.author.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{comment.author.username}</span>
                    <UserTags tags={comment.author.userTags} size="sm" />
                  </div>
                  <RichText className="mt-1 text-sm text-muted" text={comment.text} />
                  <p className="mt-1 text-xs text-muted/60">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
