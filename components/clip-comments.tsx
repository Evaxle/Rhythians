"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { FlagIcon } from "@/components/flag-icon";
import { RichText } from "@/components/rich-text";
import { UserTags } from "@/components/user-tags";

type CommentItem = {
  id: string;
  text: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
    profileHandle: string;
    avatar?: string | null;
    country?: string | null;
    flag?: string | null;
    userTags?: Array<{ tag: { name: string; slug: string } }>;
  };
};

function avatarUrl(author: CommentItem["author"]) {
  if (!author.avatar) return null;
  if (author.avatar.startsWith("http")) return author.avatar;
  return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=64`;
}

export function ClipComments({ clipId, comments: initialComments, isAuthenticated }: { clipId: string; comments: CommentItem[]; isAuthenticated: boolean }) {
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
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

  return <div className="mt-6">{isAuthenticated ? <form onSubmit={submitComment} className="space-y-3"><label htmlFor="comment" className="sr-only">Add a comment</label><textarea id="comment" value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={4} placeholder="Add to the discussion..." className="w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-muted focus:border-accent/60" /><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">{text.length}/2000</p><button disabled={submitting || !text.trim()} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Posting..." : "Post comment"}</button></div>{error ? <p className="text-sm text-red-300">{error}</p> : null}</form> : <p className="rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted"><Link href="/login" className="font-semibold text-accent hover:text-white">Log in with Discord</Link> to join the discussion.</p>}{comments.length === 0 ? <p className="mt-6 text-sm text-muted">No comments yet.</p> : <div className="mt-6 space-y-4">{comments.map((comment) => { const avatar = avatarUrl(comment.author); return <article key={comment.id} className="overflow-hidden rounded-3xl border border-border bg-background/70 p-4 sm:p-5"><div className="flex min-w-0 items-start gap-3"><Link href={`/profile/${comment.author.profileHandle}`} className="shrink-0">{avatar ? <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">{comment.author.username.charAt(0).toUpperCase()}</div>}</Link><div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><Link href={`/profile/${comment.author.profileHandle}`} className="min-w-0 max-w-full truncate text-sm font-semibold text-white hover:text-accent">{comment.author.username}#{comment.author.discriminator}</Link><FlagIcon flag={comment.author.flag} country={comment.author.country} /><div className="min-w-0 max-w-full"><UserTags tags={comment.author.userTags ?? []} size="sm" /></div></div><RichText className="mt-2 break-words text-sm leading-7 text-muted" text={comment.text} /><p className="mt-3 text-xs uppercase tracking-[0.2em] text-accent">{new Date(comment.createdAt).toLocaleDateString()}</p></div></div></article>; })}</div>}</div>;
}
