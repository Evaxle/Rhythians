import Link from "next/link";
import { prisma } from "@/lib/db";
import { AnnouncementList } from "@/components/announcement-list";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const announcements = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: { id: true, title: true, slug: true, published: true, pinned: true, createdAt: true },
  });

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Announcements</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Create and manage announcements</h1>
            <p className="mt-3 text-sm leading-7 text-muted">
              Announcements appear on the home page and the announcements listing.
            </p>
          </div>
          <Link
            href="/admin/announcements/new"
            className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2"
          >
            New announcement
          </Link>
        </div>
      </section>
      <AnnouncementList
        initialAnnouncements={announcements.map((announcement) => ({
          ...announcement,
          createdAt: announcement.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
