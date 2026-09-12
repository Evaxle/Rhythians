import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function AnnouncementPage({ params }: Props) {
  const { slug } = await params;
  const announcement = await prisma.announcement.findUnique({
    where: { slug },
  });

  if (!announcement || !announcement.published) return notFound();

  return (
    <div className="ui-page reading-page space-y-6">
      <section className="ui-page-header">
        <p className="ui-eyebrow">Announcement</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{announcement.title}</h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          Published on {announcement.createdAt.toLocaleDateString()}
        </p>
      </section>
      <article className="ui-panel text-sm leading-7 text-muted">
        {announcement.content.split("\n\n").map((paragraph: string, index: number) => (
          <p key={index} className="mt-4 first:mt-0">
            {paragraph}
          </p>
        ))}
      </article>
    </div>
  );
}
