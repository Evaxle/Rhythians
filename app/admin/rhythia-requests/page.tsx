import { prisma } from "@/lib/db";
import { RhythiaRequestManager } from "@/components/admin/rhythia-request-manager";

export const dynamic = "force-dynamic";

export default async function AdminRhythiaRequestsPage() {
  const requests = await prisma.rhythiaProfileRequest.findMany({ where: { status: "pending", resolvedAt: null }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, username: true, profileHandle: true } } } });

  return <div className="space-y-8">
    <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <p className="text-sm uppercase tracking-[0.3em] text-accent">Rhythia</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">Manual verification requests</h1>
      <p className="mt-3 text-sm leading-7 text-muted">Review players who could not complete the automatic Rhythia bio verification. Verify their Rhythia profile and approve or deny the request.</p>
    </section>
    <RhythiaRequestManager initialRequests={requests.map((request) => ({ id: request.id, userId: request.userId, username: request.user.username, profileHandle: request.user.profileHandle, profileId: request.profileId, profileUrl: request.profileUrl, rhythiaUsername: request.rhythiaUsername, claimedUsername: request.claimedUsername, adminNote: request.adminNote, createdAt: request.createdAt.toISOString() }))} />
  </div>;
}
