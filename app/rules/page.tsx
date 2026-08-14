import { prisma } from "@/lib/db";
import { getSessionUser, isOwner } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const rules = await prisma.rule.findMany({ orderBy: { order: "asc" }, where: { enabled: true } });
  const sessionUser = await getSessionUser();
  const canManage = isOwner(sessionUser);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Community Guidelines</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Server rules and expectations</h1>
          </div>
          {canManage ? (
            <Link href="/admin/rules" className="inline-flex items-center rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white">Manage rules</Link>
          ) : null}
        </div>
      </section>
      <div className="grid gap-5">
        {rules.map((rule) => (
          <article key={rule.id} id={rule.slug} className="scroll-mt-24 rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-accent/10 text-accent text-lg font-semibold">{rule.order.toString().padStart(2, "0")}</div>
              <div>
                <h2 className="text-xl font-semibold text-white">{rule.title}</h2>
                {rule.description ? <p className="mt-1 text-sm text-muted">{rule.description}</p> : null}
              </div>
            </div>
            <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
              {rule.content.split("\n\n").map((block, index) => (
                <p key={index}>{block}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
