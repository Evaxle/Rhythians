import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function confirmRhythKit(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) return;
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/rhythkit/authorize?code=${encodeURIComponent(code)}`)}`);
  await prisma.$executeRawUnsafe(`UPDATE "RhythKitDevice" SET "userId" = $1, "status" = 'authorized', "authorizedAt" = NOW() WHERE "userCode" = $2 AND "status" = 'pending' AND "expiresAt" > NOW()`, user.id, code);
  redirect(`/rhythkit/authorize?code=${encodeURIComponent(code)}&confirmed=1`);
}

export default async function RhythKitAuthorizePage({ searchParams }: { searchParams: Promise<{ code?: string; confirmed?: string }> }) {
  const params = await searchParams;
  const code = params.code?.trim().toUpperCase() ?? "";
  if (!code) return <main className="mx-auto max-w-xl rounded-3xl border border-border bg-surface/95 p-8"><h1 className="text-2xl font-semibold text-white">Invalid RhythKit authorization code</h1></main>;
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/rhythkit/authorize?code=${encodeURIComponent(code)}`)}`);

  const rows = await prisma.$queryRawUnsafe<Array<{ status: string; expiresAt: Date }>>(`SELECT "status", "expiresAt" FROM "RhythKitDevice" WHERE "userCode" = $1 LIMIT 1`, code);
  const device = rows[0];
  const confirmed = params.confirmed === "1";
  const authorized = confirmed || (device?.status === "authorized" && device.expiresAt > new Date());
  const expired = !device || device.expiresAt <= new Date() || device.status === "revoked";

  return (
    <main className="mx-auto max-w-xl rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <p className="text-sm uppercase tracking-[0.3em] text-accent">RhythKit</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">{authorized ? "Rhythians connected" : "Confirm login for RhythKit"}</h1>
      <p className="mt-4 text-sm leading-7 text-muted">
        {authorized ? "RhythKit is connected to your Rhythians account. Return to Rhythia and continue playing." : expired ? "This authorization request is invalid or expired. Start RhythKit again to create a new request." : "RhythKit is asking to connect this computer to your Rhythians account so it can submit eligible completed scores."}
      </p>
      {!authorized && !expired && (
        <form action={confirmRhythKit} className="mt-8">
          <input type="hidden" name="code" value={code} />
          <button type="submit" className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white">Confirm login for RhythKit</button>
        </form>
      )}
      {authorized && <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">✓ RhythKit is connected. You can return to the game.</div>}
    </main>
  );
}
