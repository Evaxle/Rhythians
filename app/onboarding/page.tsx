import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getOnboardingData } from "@/lib/onboarding";
import { OnboardingForm } from "@/components/onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!fullUser) redirect("/login");
  if (fullUser.onboardingCompleted) redirect("/");

  const data = await getOnboardingData(prisma);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.28em] text-accent">Welcome</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Set up your profile</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Answer a few quick questions. Your choices become tags on your profile and you can change them
          anytime in Settings.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        {data.prompts.length === 0 ? (
          <div className="space-y-6 text-center">
            <p className="text-sm leading-7 text-muted">
              Onboarding questions aren&apos;t configured yet. You can set them up in Discord and they&apos;ll
              show up here.
            </p>
            <a href="/" className="inline-flex rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/80">
              Skip for now
            </a>
          </div>
        ) : (
          <OnboardingForm prompts={data.prompts} />
        )}
      </section>
    </div>
  );
}
