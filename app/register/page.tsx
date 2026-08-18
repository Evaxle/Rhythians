import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RegisterForm } from "@/components/register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-border bg-surface/95 p-10 shadow-glow">
      <p className="text-sm uppercase tracking-[0.28em] text-accent">Join Rhythians</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">Create your account</h1>
      <p className="mt-3 text-sm leading-7 text-muted">
        After creating your account you&apos;ll answer a few quick questions to set up your profile tags.
      </p>
      <div className="mt-8">
        <RegisterForm />
      </div>
    </div>
  );
}
