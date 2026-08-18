import Link from "next/link";
import { Link2, LogIn, Map as MapIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getApprovedMaps } from "@/lib/maps";
import { MapsBrowser } from "@/components/maps/maps-browser";

export const dynamic = "force-dynamic";

export default async function MapsPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <LogIn size={26} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">Sign in to browse ranked maps</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
            Ranked challenge maps, the ranked ladder, and Rhythian Points are reserved for members with a linked
            Rhythia account. Sign in to get started.
          </p>
          <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2">
            <LogIn size={16} /> Sign in
          </Link>
        </section>
      </div>
    );
  }

  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Link2 size={26} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">Link your Rhythia account</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
            To play ranked maps and earn Rhythian Points you first need to link your Rhythia profile. Visit your
            profile page and connect your account.
          </p>
          <Link href={`/profile/${user.profileHandle}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2">
            <Link2 size={16} /> Go to my profile
          </Link>
        </section>
      </div>
    );
  }

  const data = await getApprovedMaps(true, user.id);
  const userRow = await prisma.user.findUnique({ where: { id: user.id }, select: { rhp: true } });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="space-y-2">
        <p className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-accent">
          <MapIcon size={16} /> Ranked maps
        </p>
        <h1 className="text-3xl font-semibold text-white">Challenge maps</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted">
          Beat ranked maps within your rank&apos;s rating range to earn Rhythian Points (RHP) and climb the ladder.
          Maps outside your range won&apos;t earn points.
        </p>
      </section>

      {data.rankInfo ? (
        <MapsBrowser
          maps={data.maps.map((map) => ({
            id: map.id,
            title: map.title,
            artist: map.artist,
            description: map.description,
            mapFileUrl: map.mapFileUrl,
            imageUrl: map.imageUrl,
            rating: map.rating,
            mapperName: map.mapperName,
            noteCount: map.noteCount,
            length: map.length,
            completion: map.completion,
            submittedBy: map.submittedBy,
          }))}
          rankInfo={data.rankInfo}
          userRhp={userRow?.rhp ?? 0}
        />
      ) : (
        <p className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted">Unable to load your rank.</p>
      )}
    </div>
  );
}