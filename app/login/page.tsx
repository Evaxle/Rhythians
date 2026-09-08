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
          : error === "google_config"
            ? "Google sign-in is not configured yet. Add the Google OAuth environment variables."
            : error === "google_state"
              ? "Google sign-in expired or could not be verified. Start the sign-in again."
              : error === "google_token" || error === "google_user"
                ? "Google did not return a valid account. Try signing in again."
                : error === "google_email"
                  ? "Google must provide a verified email address to sign in to Rhythians."
                  : error === "google_failed"
                    ? "Google sign-in failed while saving your Rhythians account. Try again."
                    : error === "account_suspended"
                      ? "This Rhythians account is currently suspended."
                      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {errorMessage && <p className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{errorMessage}</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
          <p className="text-sm uppercase tracking-[0.28em] text-accent">Google</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Continue with Google</h2>
          <p className="mt-3 text-sm leading-7 text-muted">Use a Google account to sign in or create a Rhythians account automatically with your verified email.</p>
          <a href="/api/auth/google" className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white px-6 py-3 text-sm font-semibold text-[#1f1f1f] transition hover:bg-white/90">
            <span className="text-base font-bold">G</span> Continue with Google
          </a>
        </section>

        <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
          <p className="text-sm uppercase tracking-[0.28em] text-accent">Discord</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Continue with Discord</h2>
          <p className="mt-3 text-sm leading-7 text-muted">Sign in with your Discord account. Your roles sync automatically to tags on your profile.</p>
          <a href="/api/auth/login" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#5865F2] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#4752c4]">Continue with Discord</a>
        </section>

        <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
          <p className="text-sm uppercase tracking-[0.28em] text-accent">Account</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Sign in with username</h2>
          <p className="mt-3 text-sm leading-7 text-muted">Use your Rhythians username or email and password.</p>
          <div className="mt-6"><LoginForm /></div>
        </section>
      </div>
    </div>
  );
}
