import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RegisterForm } from "@/components/register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto max-w-xl ui-panel sm:p-10">
      <p className="ui-eyebrow">Join Rhythians</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Create your account</h1>
      <p className="mt-3 text-sm leading-7 text-muted">Create a Rhythians account with Google or use an email, username, and password. Your player classification is assigned automatically after you link Rhythia.</p>

      <a href="/api/auth/google" className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white px-6 py-3 text-sm font-semibold text-[#1f1f1f] transition hover:bg-white/90">
        <span className="text-base font-bold">G</span> Sign up with Google
      </a>

      <div className="my-7 flex items-center gap-3"><div className="h-px flex-1 bg-white/10" /><span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">or</span><div className="h-px flex-1 bg-white/10" /></div>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-semibold text-accent hover:text-white">Sign in</Link></p>
    </div>
  );
}
