import { prisma } from "@/lib/db";
import { SendAlertForm } from "@/components/admin/send-alert-form";

export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const [users, usersWithoutTags] = await Promise.all([
    prisma.user.findMany({ orderBy: { username: "asc" }, select: { id: true, username: true, displayName: true, profileHandle: true } }),
    prisma.user.count({ where: { userTags: { none: {} } } }),
  ]);

  return (
    <div className="ui-page space-y-6">
      <section className="ui-page-header">
        <p className="ui-eyebrow">Administration</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Alerts</h1>
        <p className="mt-3 text-sm leading-7 text-muted">Notify all users or send the same alert to multiple selected users.</p>
      </section>
      <SendAlertForm users={users} usersWithoutTags={usersWithoutTags} />
    </div>
  );
}
