import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { redirect } from "next/navigation";
import { CategoryAdmin } from "@/components/categories/category-admin";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!(await canAccessAdmin(user))) redirect("/");

  const maps = await prisma.categoryMap.findMany({
    orderBy: [{ category: "asc" }, { level: "asc" }, { createdAt: "desc" }],
    include: {
      submittedBy: { select: { username: true, displayName: true, profileHandle: true } },
      reviewedBy: { select: { username: true, displayName: true, profileHandle: true } },
    },
  });

  const serializedMaps = maps.map((map) => ({ ...map, createdAt: map.createdAt.toISOString() }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Categories</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Category map management</h1>
        <p className="mt-2 text-sm text-muted">
          Add maps to skill categories (Jumps, Stream, Tech, Off Grid) and levels 1-10, then approve them so players
          can check their scores.
        </p>
      </div>
      <CategoryAdmin initialMaps={serializedMaps} />
    </div>
  );
}
