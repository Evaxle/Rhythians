import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser, isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const announcements = await prisma.announcement.findMany({
    where: { published: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: { id: true, title: true, slug: true, pinned: true, createdAt: true },
  });
  const sessionUser = await getSessionUser();
  const canManage = isOwner(sessionUser);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Announcements</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Latest community updates</h1>
          </div>
          {canManage ? (
            <Link href="/admin/announcements" className="inline-flex items-center rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white">Create announcement</Link>
          ) : null}
        </div>
      </section>
      <div className="grid gap-5">
        {announcements.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
            <p className="text-sm text-muted">Published announcements will appear here once created by an administrator.</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <Link
              key={announcement.id}
              href={`/announcements/${announcement.slug}`}
              className="group rounded-3xl border border-border bg-surface/95 p-6 shadow-glow transition hover:border-accent/40 hover:bg-surface/90"
            >
              <div className="flex items-center gap-2">
                {announcement.pinned ? (
                  <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-0.5 text-xs font-medium text-accent">Pinned</span>
                ) : null}
                <span className="text-xs text-muted">{announcement.createdAt.toLocaleDateString()}</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-white group-hover:text-accent">{announcement.title}</h2>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
