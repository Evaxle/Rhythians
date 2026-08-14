"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type CommentItem = {
  id: string;
  text: string;
  createdAt: string;
  author: { username: string; discriminator: string };
};

export function ClipComments({
  clipId,
  comments: initialComments,
  isAuthenticated,
}: {
  clipId: string;
  comments: CommentItem[];
  isAuthenticated: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/clips/${clipId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not post comment.");
      setComments((current) => [data.comment, ...current]);
      setText("");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Could not post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      {isAuthenticated ? (
        <form onSubmit={submitComment} className="space-y-3">
          <label htmlFor="comment" className="sr-only">Add a comment</label>
          <textarea
            id="comment"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Add to the discussion..."
            className="w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-muted focus:border-accent/60"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">{text.length}/2000</p>
            <button disabled={submitting || !text.trim()} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "Posting..." : "Post comment"}
            </button>
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </form>
      ) : (
        <p className="rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted">
          <Link href="/login" className="font-semibold text-accent hover:text-white">Log in with Discord</Link> to join the discussion.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No comments yet.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {comments.map((comment) => (
            <article key={comment.id} className="rounded-3xl border border-border bg-background/70 p-5">
              <p className="text-sm font-semibold text-white">{comment.author.username}#{comment.author.discriminator}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted">{comment.text}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-accent">{new Date(comment.createdAt).toLocaleDateString()}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
