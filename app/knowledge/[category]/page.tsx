import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ category: string }>;
};

export default async function KnowledgeCategoryPage({ params }: Props) {
  const { category: categorySlug } = await params;
  const category = await prisma.knowledgeCategory.findUnique({
    where: { slug: categorySlug },
    include: { articles: { where: { published: true }, orderBy: { updatedAt: "desc" } } },
  });

  if (!category) return notFound();

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Knowledge category</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{category.name}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{category.description ?? "Browse curated articles and guides."}</p>
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        {category.articles.length === 0 ? (
          <div className="rounded-3xl border border-border bg-background/70 p-8 text-sm text-muted">No published articles are available yet.</div>
        ) : (
          category.articles.map((article) => (
            <Link
              key={article.id}
              href={`/knowledge/${category.slug}/${article.slug}`}
              className="group rounded-3xl border border-border bg-surface/95 p-6 transition hover:border-accent/40 hover:bg-surface/90"
            >
              <h2 className="text-xl font-semibold text-white group-hover:text-accent">{article.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{article.description}</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
