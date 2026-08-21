import Link from "next/link";
import { Link2, LogIn, Swords } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import ChallengeMapSubmitForm from "@/components/maps/challenge-map-submit-form-v2";

export const dynamic = "force-dynamic";

export default async function ChallengeMapSubmitPage() {
  const user = await getSessionUser();
  if (!user) return <div className="mx-auto max-w-3xl space-y-8"><section className="rounded-3xl border border-border bg-surface/95 p-8 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><LogIn size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Sign in to submit a challenge map</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Challenge map submissions require a linked Rhythia account.</p><Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white"><LogIn size={16} /> Sign in</Link></section></div>;
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return <div className="mx-auto max-w-3xl space-y-8"><section className="rounded-3xl border border-border bg-surface/95 p-8 text-center shadow-glow"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Link2 size={26} /></div><h1 className="mt-5 text-2xl font-semibold text-white">Link your Rhythia account</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Link your Rhythia profile before submitting challenge maps.</p><Link href={`/profile/${user.profileHandle}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white"><Link2 size={16} /> Go to my profile</Link></section></div>;
  return <div className="mx-auto max-w-3xl space-y-8"><section className="space-y-2"><p className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-accent"><Swords size={16} /> Submit a challenge map</p><h1 className="text-3xl font-semibold text-white">Add a challenge map</h1><p className="text-sm leading-7 text-muted">Choose Main Challenge, Jumps, Stream, Tech, or Off Grid and request a level. Challenge maps do not award RHP.</p></section><ChallengeMapSubmitForm /></div>;
}
