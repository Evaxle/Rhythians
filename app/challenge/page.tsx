import Link from "next/link";
import { Link2, LogIn, Swords } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getChallengeMapsWithCompletions, getUserChallengeLevel } from "@/lib/challenge";
import { ChallengeBrowser } from "@/components/challenge/challenge-browser";

export const dynamic = "force-dynamic";

export default async function ChallengePage() {
  const user = await getSessionUser();
  if (!user) {
    return <div className="mx-auto max-w-2xl space-y-6"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><LogIn size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Sign in to play Challenge</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Link your Rhythia account to progress through Challenge Levels 1-20.</p><Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><LogIn size={16} /> Sign in</Link></section></div>;
  }

  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) {
    return <div className="mx-auto max-w-2xl space-y-6"><section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Link2 size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Link your Rhythia account</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Connect Rhythia before playing Challenge maps and progressing through the 20 levels.</p><Link href={`/profile/${user.profileHandle}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><Link2 size={16} /> Go to my profile</Link></section></div>;
  }

  const [maps, level] = await Promise.all([getChallengeMapsWithCompletions(user.id), getUserChallengeLevel(user.id)]);

  return <div className="mx-auto max-w-5xl space-y-8"><section className="space-y-2"><p className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-accent"><Swords size={16} /> Challenge</p><h1 className="text-3xl font-semibold text-white">Challenge Levels</h1><p className="max-w-2xl text-sm leading-7 text-muted">Progress from Level 1 to Level 20 by beating Challenge maps in order. Challenge progression is separate from the category skill system and from the Maps page.</p></section><ChallengeBrowser maps={maps} level={level} /></div>;
}
