import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface/95 p-10 shadow-glow">
      <div className="space-y-6 text-center">
        <p className="text-sm uppercase tracking-[0.28em] text-accent">Login</p>
        <h1 className="text-3xl font-semibold text-white">Sign in with Discord</h1>
        <p className="text-sm leading-7 text-muted">Authenticate using your Discord account to access community features, submit clips, and contribute knowledge.</p>
        <div className="flex justify-center">
          <Link href="/api/auth/login" className="inline-flex items-center gap-3 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2">
            Continue with Discord
          </Link>
        </div>
      </div>
    </div>
  );
}
