import { prisma } from "@/lib/db";
import { SendAlertForm } from "@/components/admin/send-alert-form";

export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const [users, usersWithoutTags] = await Promise.all([
    prisma.user.findMany({ orderBy: { username: "asc" }, select: { id: true, username: true, displayName: true, profileHandle: true } }),
    prisma.user.count({ where: { userTags: { none: {} } } }),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Administration</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Alerts</h1>
        <p className="mt-3 text-sm leading-7 text-muted">Notify all users or send the same alert to multiple selected users.</p>
      </section>
      <SendAlertForm users={users} usersWithoutTags={usersWithoutTags} />
    </div>
  );
}
