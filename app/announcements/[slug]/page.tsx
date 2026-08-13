import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  params: { slug: string };
};

export default async function AnnouncementPage({ params }: Props) {
  const announcement = await prisma.announcement.findUnique({
    where: { slug: params.slug },
  });

  if (!announcement || !announcement.published) return notFound();

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Announcement</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{announcement.title}</h1>
        <p className="mt-4 text-sm leading-7 text-muted">Published on {announcement.createdAt.toLocaleDateString()}</p>
      </section>
      <article className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow text-sm leading-7 text-muted">
        {announcement.content.split("\n\n").map((paragraph, index) => (
          <p key={index} className="mt-4 first:mt-0">{paragraph}</p>
        ))}
      </article>
    </div>
  );
}
