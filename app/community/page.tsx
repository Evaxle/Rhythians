import Link from "next/link";

export default function CommunityPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_0.9fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Community</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Discord server information</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Stay connected with the Discord community, discover server features, and see how the website complements the chat experience.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="https://discord.gg/" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent2">Join Discord</Link>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-background/80 p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Server snapshot</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-border bg-surface p-5">
                <p className="text-sm text-muted">Members</p>
                <p className="mt-2 text-3xl font-semibold">—</p>
              </div>
              <div className="rounded-3xl border border-border bg-surface p-5">
                <p className="text-sm text-muted">Online</p>
                <p className="mt-2 text-3xl font-semibold">—</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h2 className="text-xl font-semibold text-white">Why this website exists</h2>
        <p className="mt-4 text-sm leading-7 text-muted">The website provides organized knowledge, clips, stable resources, and announcements, while Discord remains the place for real-time discussion and events.</p>
      </section>
    </div>
  );
}
