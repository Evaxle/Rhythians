import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser().catch(() => null);
  if (user) redirect("/");
  const error = (await searchParams)?.error;
  const errorMessage =
    error === "discord_config"
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
    <div className="ui-page mx-auto max-w-md py-4 sm:py-8">
      <section className="ui-panel">
        <p className="ui-eyebrow">Welcome back</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Sign in to Rhythians
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Your maps, progress, and community.
        </p>
        {errorMessage && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"
          >
            {errorMessage}
          </p>
        )}
        <div className="mt-6 grid gap-3">
          <a
            href="/api/auth/google"
            className="ui-button w-full border border-white/15 bg-white text-[#1f1f1f] hover:bg-white/90"
          >
            <span className="text-base font-bold" aria-hidden="true">
              G
            </span>{" "}
            Continue with Google
          </a>
          <a
            href="/api/auth/login"
            className="ui-button w-full bg-[#5865F2] text-white hover:bg-[#4752c4]"
          >
            Continue with Discord
          </a>
        </div>
        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-white/10" />
          or use your account
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <LoginForm />
      </section>
    </div>
  );
}
