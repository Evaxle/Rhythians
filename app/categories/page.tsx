import Link from "next/link";
import { Link2, LogIn, Layers } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { CATEGORIES, getCategoryMapsWithCompletions, getCategoryStats, getUserCategoryLevels, serializeCategoryMapForClient, type Category } from "@/lib/categories";
import { getChallengeMapsWithCompletions, getUserChallengeLevel } from "@/lib/challenge";
import { CategoriesBrowser } from "@/components/categories/categories-browser";
import { ErrorState } from "@/components/error-state";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ tab?: string }> };

export default async function CategoriesPage({ searchParams }: Props) {
  const user = await getSessionUser();
  const requestedTab = (await searchParams)?.tab;
  const defaultTab = requestedTab === "challenge" || requestedTab === "leaderboards" || requestedTab === "stats" ? requestedTab : "maps";
  if (!user) return <div className="mx-auto max-w-2xl space-y-6"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><LogIn size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Sign in to browse categories</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Skill categories and Challenge progression are reserved for members with a linked Rhythia account. Sign in to get started.</p><Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><LogIn size={16} /> Sign in</Link></section></div>;
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return <div className="mx-auto max-w-2xl space-y-6"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Link2 size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Link your Rhythia account</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">To play category and Challenge maps you first need to link your Rhythia profile.</p><Link href={`/profile/${user.profileHandle}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><Link2 size={16} /> Go to my profile</Link></section></div>;
  let levels: Awaited<ReturnType<typeof getUserCategoryLevels>>; let stats: Awaited<ReturnType<typeof getCategoryStats>>; let mapsByCategory: Awaited<ReturnType<typeof getCategoryMapsWithCompletions>>[]; let challengeMaps: Awaited<ReturnType<typeof getChallengeMapsWithCompletions>>; let challengeLevel: number;
  try { [levels, stats, mapsByCategory, challengeMaps, challengeLevel] = await Promise.all([getUserCategoryLevels(user.id), getCategoryStats(user.id), Promise.all(CATEGORIES.map((category) => getCategoryMapsWithCompletions(user.id, category))), getChallengeMapsWithCompletions(user.id), getUserChallengeLevel(user.id)]); } catch { return <div className="mx-auto max-w-2xl space-y-6"><ErrorState title="Categories unavailable" description="The categories or Challenge database tables are missing or not migrated yet. Try again after the database is repaired." /></div>; }
  const maps = Object.fromEntries(CATEGORIES.map((category, index) => [category, mapsByCategory[index].map(serializeCategoryMapForClient)])) as Record<Category, ReturnType<typeof serializeCategoryMapForClient>[]>;
  return <div className="mx-auto max-w-5xl space-y-8"><section className="space-y-2"><p className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-accent"><Layers size={16} /> Categories</p><h1 className="text-3xl font-semibold text-white">Skill categories</h1><p className="max-w-2xl text-sm leading-7 text-muted">Climb levels 1-10 in Jumps, Stream, Tech, Off Grid, and Vibro. Challenge is also available here with 10 curated levels.</p></section><CategoriesBrowser levels={levels} stats={stats} maps={maps} currentUserId={user.id} challengeMaps={challengeMaps} challengeLevel={challengeLevel} defaultTab={defaultTab as "maps" | "leaderboards" | "stats" | "challenge"} /></div>;
}
