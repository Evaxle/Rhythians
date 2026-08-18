import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const user = await getSessionUser().catch(() => null);
  if (user) redirect("/");
  const error = (await searchParams)?.error;
  const errorMessage = error === "discord_config"
    ? "Discord rejected the OAuth configuration. Check the client secret and exact redirect URI."
    : error === "discord_network"
      ? "Discord could not be reached. Try again shortly."
      : error === "discord_user" || error === "discord_token"
        ? "Discord authentication did not return a valid account. Try again."
        : error === "oauth_failed"
          ? "Discord sign-in failed while saving your account. Try again."
          : null;

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.28em] text-accent">Discord</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Continue with Discord</h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          Sign in with your Discord account. Your roles sync automatically to tags on your profile.
        </p>
        <a
          href="/api/auth/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#5865F2] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
        >
          Continue with Discord
        </a>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.28em] text-accent">Account</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Sign in with username</h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          Use your Rhythians username or email and password.
        </p>
        <div className="mt-6">
          {errorMessage && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{errorMessage}</p>}
          <LoginForm />
        </div>
      </section>
    </div>
  );
}
