import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prisma } from "@/lib/db";
import { extractHeadings } from "@/lib/markdown";

type Props = {
  params: { category: string; slug: string };
};

export default async function KnowledgeArticlePage({ params }: Props) {
  const article = await prisma.knowledgeArticle.findUnique({
    where: { slug: params.slug },
    include: { author: true, category: true },
  });

  if (!article || article.category.slug !== params.category || !article.published) {
    return notFound();
  }

  const related = await prisma.knowledgeArticle.findMany({
    where: { categoryId: article.categoryId, published: true, id: { not: article.id } },
    orderBy: { updatedAt: "desc" },
    take: 4,
  });

  const toc = extractHeadings(article.content);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">{article.category.name}</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{article.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{article.description}</p>
          </div>
          <div className="rounded-3xl border border-border bg-background/80 px-5 py-4 text-sm text-muted">
            <p>Last updated</p>
            <p className="mt-2 text-lg font-semibold text-white">{article.updatedAt.toLocaleDateString()}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
        <article className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
          <div className="prose prose-invert max-w-none space-y-6 text-sm leading-7 text-muted prose-headings:text-white prose-a:text-accent prose-code:bg-surface prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-blockquote:border-l-2 prose-blockquote:border-accent/40 prose-blockquote:bg-white/5 prose-blockquote:px-5 prose-blockquote:text-muted">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
          </div>
        </article>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Author</p>
            <p className="mt-3 text-base font-semibold text-white">{article.author.username}#{article.author.discriminator}</p>
            <p className="mt-2 text-sm text-muted">{article.author.roles.length > 0 ? article.author.roles.map((r) => r.role.name).join(", ") : "Member"}</p>
          </div>

          {toc.length > 0 ? (
            <div className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
              <p className="text-sm uppercase tracking-[0.3em] text-accent">On this page</p>
              <div className="mt-4 space-y-3 text-sm text-muted">
                {toc.map((item) => (
                  <a key={item.slug} href={`#${item.slug}`} className="block rounded-2xl px-3 py-2 transition hover:bg-white/5">
                    <span className={item.level === 3 ? "pl-4" : ""}>{item.text}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {related.length > 0 ? (
            <div className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
              <p className="text-sm uppercase tracking-[0.3em] text-accent">Related</p>
              <div className="mt-4 space-y-3">
                {related.map((item) => (
                  <Link key={item.id} href={`/knowledge/${item.category.slug}/${item.slug}`} className="block rounded-2xl px-3 py-3 transition hover:bg-white/5">
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="text-sm text-muted">{item.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
