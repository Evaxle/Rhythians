import { prisma } from "@/lib/db";
import { ReportsManager } from "@/components/admin/reports-manager";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const reports = await prisma.report.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      reporter: { select: { id: true, username: true, discriminator: true, profileHandle: true, avatar: true } },
    },
  });

  const userIds = new Set<string>();
  const clipIds = new Set<string>();
  for (const report of reports) {
    if (report.targetType === "user") userIds.add(report.targetId);
    if (report.targetType === "clip") clipIds.add(report.targetId);
  }

  const [targetUsers, targetClips, bannedUsers] = await Promise.all([
    userIds.size
      ? prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, username: true, discriminator: true, profileHandle: true, isSuspended: true, avatar: true } })
      : [],
    clipIds.size
      ? prisma.clip.findMany({
          where: { id: { in: [...clipIds] } },
          select: { id: true, title: true, status: true, uploader: { select: { id: true, username: true } } },
        })
      : [],
    prisma.user.findMany({
      where: { isSuspended: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true, username: true, discriminator: true, profileHandle: true, avatar: true, updatedAt: true },
    }),
  ]);

  const userById = new Map(targetUsers.map((u) => [u.id, u]));
  const clipById = new Map(targetClips.map((c) => [c.id, c]));

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Reports</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">User and post reports</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Review reports submitted by community members. Warn or ban the reported user, manage banned
            users, or resolve and dismiss reports you&apos;ve handled.
          </p>
        </div>
      </section>

      <ReportsManager
        initialReports={reports.map((report) => ({
          id: report.id,
          targetType: report.targetType,
          targetId: report.targetId,
          reason: report.reason,
          description: report.description,
          status: report.status,
          createdAt: report.createdAt.toISOString(),
          reporter: report.reporter,
          targetUser: report.targetType === "user" ? (userById.get(report.targetId) ?? null) : null,
          targetClip: report.targetType === "clip" ? (clipById.get(report.targetId) ?? null) : null,
        }))}
        initialBannedUsers={bannedUsers.map((user) => ({
          id: user.id,
          username: user.username,
          discriminator: user.discriminator,
          profileHandle: user.profileHandle,
          avatar: user.avatar,
          bannedAt: user.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
