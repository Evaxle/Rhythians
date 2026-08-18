import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AnnouncementForm } from "@/components/announcement-form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditAnnouncementPage({ params }: Props) {
  const { id } = await params;
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, title: true, content: true, published: true, pinned: true },
  });

  if (!announcement) return notFound();

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Announcements</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Edit announcement</h1>
      </section>
      <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <AnnouncementForm initial={announcement} />
      </div>
    </div>
  );
}
