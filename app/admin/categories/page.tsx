import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { redirect } from "next/navigation";
import { CategoryAdmin } from "@/components/categories/category-admin";
import { ErrorState } from "@/components/error-state";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!(await canAccessAdmin(user))) redirect("/");

  let serializedMaps: Parameters<typeof CategoryAdmin>[0]["initialMaps"];

  try {
    const maps = await prisma.categoryMap.findMany({
      orderBy: [{ category: "asc" }, { level: "asc" }, { createdAt: "desc" }],
      include: {
        submittedBy: { select: { username: true, displayName: true, profileHandle: true } },
        reviewedBy: { select: { username: true, displayName: true, profileHandle: true } },
      },
    });

    serializedMaps = maps.map((map) => ({
      id: map.id,
      category: map.category,
      level: map.level,
      title: map.title,
      artist: map.artist,
      mapFileUrl: map.mapFileUrl,
      mapperName: map.mapperName,
      noteCount: map.noteCount,
      length: map.length,
      sourceBeatmapId: map.sourceBeatmapId,
      status: map.status,
      reviewerNote: map.reviewerNote,
      createdAt: map.createdAt.toISOString(),
      submittedBy: map.submittedBy,
      reviewedBy: map.reviewedBy,
    }));
  } catch {
    return (
      <ErrorState
        title="Categories unavailable"
        description="The categories database tables are missing or not migrated yet. Run npm run db:migrate and try again."
      />
    );
  }

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
