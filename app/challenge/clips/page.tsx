import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { isCategory } from "@/lib/category-constants";
import { getCompletionClipFeed, type CompletionClipKind } from "@/lib/completion-clips";
import { ChallengeClipsBrowser } from "@/components/challenge/challenge-clips-browser";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ kind?: string; category?: string; level?: string }> };

export default async function ChallengeClipsPage({ searchParams }: Props) {
  const params = await searchParams;
  const kind: CompletionClipKind | undefined = params.kind === "challenge" || params.kind === "category" ? params.kind : undefined;
  const category = typeof params.category === "string" && isCategory(params.category) ? params.category : undefined;
  const parsedLevel = Number(params.level);
  const level = Number.isInteger(parsedLevel) && parsedLevel >= 7 && parsedLevel <= 10 ? parsedLevel : undefined;
  const user = await getSessionUser();
  const items = await getCompletionClipFeed({ kind, category, level, limit: 80 });
  const serialized = items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), comments: item.comments.map((comment) => ({ ...comment, createdAt: comment.createdAt.toISOString() })) }));
  return <div className="ui-page space-y-5"><section className="ui-card rounded-[2rem] p-5 sm:p-6"><p className="ui-kicker text-accent">Challenge proof</p><div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold text-white sm:text-4xl">Completion clips</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Level 7-10 Challenge and category submissions with review status, reviewer notes, and comments.</p></div><Link href="/clips" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">Main clips</Link></div><div className="mt-4 flex flex-wrap gap-2 text-xs text-muted"><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">{kind ?? "All types"}</span>{category && <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">{category}</span>}{level && <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Level {level}</span>}<Link href="/challenge/clips" className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 font-semibold text-accent">Clear filters</Link></div></section><ChallengeClipsBrowser initialItems={serialized} signedIn={Boolean(user)} /></div>;
}
