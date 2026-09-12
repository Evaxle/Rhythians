import { prisma } from "@/lib/db";
import { RhythiaRequestManager } from "@/components/admin/rhythia-request-manager";
import { RhythiaManualLinker } from "@/components/admin/rhythia-manual-linker";

export const dynamic = "force-dynamic";

export default async function AdminRhythiaRequestsPage() {
  const requests = await prisma.rhythiaProfileRequest.findMany({ where: { status: "pending", resolvedAt: null }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, username: true, profileHandle: true } } } });

  return <div className="ui-page space-y-6">
    <section className="ui-page-header">
      <p className="ui-eyebrow">Rhythia</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Manual verification requests</h1>
      <p className="mt-3 text-sm leading-7 text-muted">Review players who could not complete the automatic Rhythia bio verification, or manually link any Rhythians user to a Rhythia profile.</p>
    </section>
    <RhythiaManualLinker />
    <RhythiaRequestManager initialRequests={requests.map((request) => ({ id: request.id, userId: request.userId, username: request.user.username, profileHandle: request.user.profileHandle, profileId: request.profileId, profileUrl: request.profileUrl, rhythiaUsername: request.rhythiaUsername, claimedUsername: request.claimedUsername, adminNote: request.adminNote, createdAt: request.createdAt.toISOString() }))} />
  </div>;
}
