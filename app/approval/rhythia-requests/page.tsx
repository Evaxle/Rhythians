import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessRhythiaReview } from "@/lib/admin-access";
import { RhythiaRequestsManager } from "@/components/admin/rhythia-requests-manager";

export const dynamic = "force-dynamic";

export default async function ApprovalRhythiaRequestsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!(await canAccessRhythiaReview(user))) redirect("/approval");

  const requests = await prisma.rhythiaProfileRequest.findMany({
    include: {
      user: { select: { id: true, username: true, discriminator: true, profileHandle: true, avatar: true } },
      resolvedByUser: { select: { id: true, username: true, discriminator: true, profileHandle: true, avatar: true } },
    },
  });

  const rank: Record<string, number> = { pending: 0, approved: 1, denied: 2 };
  requests.sort((a, b) => (rank[a.status] - rank[b.status]) || (b.createdAt.getTime() - a.createdAt.getTime()));

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Staff review</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Rhythia profile requests</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Review requests from users who need their Rhythia profile linked to their Rhythians account.
        </p>
      </section>
      <RhythiaRequestsManager
        initialRequests={requests.map((request) => ({
          id: request.id,
          profileId: request.profileId,
          profileUrl: request.profileUrl,
          rhythiaUsername: request.rhythiaUsername,
          claimedUsername: request.claimedUsername,
          status: request.status,
          adminNote: request.adminNote,
          createdAt: request.createdAt.toISOString(),
          resolvedAt: request.resolvedAt?.toISOString() ?? null,
          resolvedBy: request.resolvedByUser,
          user: request.user,
        }))}
      />
    </div>
  );
}
