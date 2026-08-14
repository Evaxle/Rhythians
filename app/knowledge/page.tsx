import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser, isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getCategories() {
  return prisma.knowledgeCategory.findMany({ orderBy: { order: "asc" } });
}

export default async function KnowledgePage() {
  const categories = await getCategories();
  const sessionUser = await getSessionUser();
  const canManage = isOwner(sessionUser);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Knowledge hub</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Discover community guides and documentation</h1>
          </div>
          {canManage ? (
            <Link href="/admin/articles" className="inline-flex items-center rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white">Manage knowledge</Link>
          ) : null}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/knowledge/${category.slug}`}
            className="group rounded-3xl border border-border bg-surface/95 p-6 transition hover:border-accent/40 hover:bg-surface/90"
          >
            <h2 className="text-xl font-semibold text-white group-hover:text-accent">{category.name}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{category.description ?? "Community content and guides."}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
