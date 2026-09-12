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
    <div className="ui-page space-y-6">
      <section className="ui-page-header">
        <p className="ui-eyebrow">Announcements</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Edit announcement</h1>
      </section>
      <div className="ui-panel">
        <AnnouncementForm initial={announcement} />
      </div>
    </div>
  );
}
