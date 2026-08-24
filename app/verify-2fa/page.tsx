import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VerifyTwoFactorForm } from "@/components/verify-two-factor-form";
import { MFA_COOKIE_NAME } from "@/lib/email-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function VerifyTwoFactorPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(MFA_COOKIE_NAME)?.value) redirect("/login");

  return <div className="mx-auto max-w-lg"><section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><p className="text-sm uppercase tracking-[0.28em] text-accent">Account security</p><h1 className="mt-3 text-3xl font-semibold text-white">Enter your security code</h1><p className="mt-3 text-sm leading-7 text-muted">We sent a six-digit code to the verified email address on your Rhythians account. Enter it to finish signing in.</p><div className="mt-8"><VerifyTwoFactorForm /></div></section></div>;
}
