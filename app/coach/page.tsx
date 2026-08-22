import Link from "next/link";

export default function CoachPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-2xl">👤</div>
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Rhythian Coach</p>
            <h1 className="mt-1 text-3xl font-semibold text-white">What is a Rhythian Coach?</h1>
          </div>
        </div>
        <div className="mt-8 space-y-5 text-sm leading-7 text-muted">
          <p>Rhythian Coaches are trusted members of the community who can help other players improve. They are people you can turn to when you want another set of eyes on your gameplay, advice on technique, or help figuring out what to work on next.</p>
          <p>Coaches can leave feedback on submitted clips and help players understand what they are doing well and where they can improve. The goal is useful, respectful feedback that helps players make real progress.</p>
          <p>The coach icon means the person has been verified as a Rhythian Coach. It is there so you can quickly recognize coaches anywhere their username appears on the site.</p>
        </div>
        <Link href="/" className="mt-8 inline-flex rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40 hover:bg-white/10">Back to Rhythians</Link>
      </section>
    </main>
  );
}
