import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getUserCategoryLevel } from "@/lib/categories";
import { getUserChallengeLevel } from "@/lib/challenge";
import { isCategory, CATEGORY_LABELS, type Category } from "@/lib/category-constants";
import { CompletionClipSubmit } from "@/components/completion-clip-submit";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ kind?: string; category?: string; level?: string }> };

export default async function CompletionPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/completion");
  const params = await searchParams;
  const kind = params.kind === "challenge" ? "challenge" : "category";
  const level = Number(params.level);
  if (!Number.isInteger(level) || level < 7 || level > 10) return <main className="mx-auto max-w-3xl px-6 py-16"><div className="rounded-3xl border border-border bg-surface p-8 text-white">Choose a completion level from 7 through 10.</div></main>;

  let currentLevel: number;
  let category: Category | undefined;
  if (kind === "category") {
    if (!isCategory(params.category)) return <main className="mx-auto max-w-3xl px-6 py-16"><div className="rounded-3xl border border-border bg-surface p-8 text-white">Choose a valid category.</div></main>;
    category = params.category as Category;
    currentLevel = await getUserCategoryLevel(user.id, category);
  } else {
    currentLevel = await getUserChallengeLevel(user.id);
  }

  if (currentLevel !== level - 1) return <main className="mx-auto max-w-3xl px-6 py-16"><div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-8"><h1 className="text-2xl font-semibold text-white">Completion unavailable</h1><p className="mt-3 text-sm leading-7 text-red-100">User is not level {level - 1} requirement{category ? ` in ${CATEGORY_LABELS[category]}` : " in Challenge"}. You must earn the previous level before submitting a Level {level} completion.</p></div></main>;

  return <main className="mx-auto max-w-4xl px-6 py-12"><div className="mb-8"><p className="text-sm uppercase tracking-[0.3em] text-accent">Completion proof</p><h1 className="mt-2 text-3xl font-semibold text-white">Submit Level {level} completion</h1><p className="mt-3 text-sm text-muted">Your clip will be reviewed before the level is awarded.</p></div><CompletionClipSubmit kind={kind} category={category} level={level} username={user.username} uploadedAt={new Date().toLocaleDateString()} /></main>;
}
