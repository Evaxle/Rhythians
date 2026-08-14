import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminArticlePage({ params }: Props) {
  const { id } = await params;
  const article = await prisma.knowledgeArticle.findUnique({
    where: { id },
    include: { category: true, author: true },
  });

  if (!article) return notFound();

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Article</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{article.title}</h1>
            <p className="mt-2 text-sm text-muted">Category: {article.category.name}</p>
          </div>
          <div className="space-x-2">
            <button className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent2">Edit</button>
            <button className="rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-muted hover:border-accent/40 hover:text-white">Publish</button>
          </div>
        </div>
      </section>
      <div className="rounded-3xl border border-border bg-background/70 p-8 text-sm text-muted">
        <p className="font-semibold text-white">Draft content preview</p>
        <p className="mt-4">{article.content.slice(0, 250)}...</p>
      </div>
    </div>
  );
}
