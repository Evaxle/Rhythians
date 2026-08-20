import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RhythKitAuthorizePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = (await searchParams).code?.trim().toUpperCase() ?? "";
  if (!code) return <main className="mx-auto max-w-xl rounded-3xl border border-border bg-surface/95 p-8"><h1 className="text-2xl font-semibold text-white">Invalid RhythKit authorization code</h1></main>;
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/rhythkit/authorize?code=${encodeURIComponent(code)}`)}`);

  const result = await prisma.$executeRawUnsafe(`UPDATE "RhythKitDevice" SET "userId" = $1, "status" = 'authorized', "authorizedAt" = NOW() WHERE "userCode" = $2 AND "status" = 'pending' AND "expiresAt" > NOW()`, user.id, code);
  const authorized = result > 0;

  return (
    <main className="mx-auto max-w-xl rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <p className="text-sm uppercase tracking-[0.3em] text-accent">RhythKit</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">{authorized ? "RhythKit connected" : "Authorization unavailable"}</h1>
      <p className="mt-4 text-sm leading-7 text-muted">{authorized ? "You can return to Rhythia. RhythKit will finish connecting automatically." : "This code is invalid, expired, or has already been used."}</p>
    </main>
  );
}
