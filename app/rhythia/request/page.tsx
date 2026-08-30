import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RhythiaRequestForm } from "@/components/rhythia-request-form";

export const dynamic = "force-dynamic";

export default async function RhythiaRequestPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <div className="mx-auto max-w-3xl space-y-8">
    <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <p className="text-sm uppercase tracking-[0.3em] text-accent">Rhythia verification</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">Connect your Rhythia account</h1>
      <p className="mt-3 text-sm leading-7 text-muted">Normally you can verify ownership by placing a temporary code in your Rhythia bio. If that check does not work, you can send a manual verification request to the site admin.</p>
    </section>
    <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><RhythiaRequestForm /></section>
  </div>;
}
