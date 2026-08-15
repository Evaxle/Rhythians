import { PatternViewer } from "@/components/knowledge/pattern-viewer";
import { patterns } from "@/lib/knowledge";

export default function PatternsWikiPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Patterns Wiki</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Every pattern, mapped on a 3×3 grid</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          A pattern is a recognizable sequence of notes. Names describe movement, not a mandatory
          recipe — the same shape changes difficulty with timing and spacing. Each grid below
          animates the pattern in perspective, with square notes approaching as they do in game.
          Press any mapping button to load that version into the animation.
        </p>
      </section>

      {patterns.map((pattern, index) => (
        <section
          key={pattern.slug}
          id={pattern.slug}
          className="scroll-mt-24 rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"
        >
          <div className="grid gap-8 lg:grid-cols-[340px_1fr] lg:items-start">
            <div className="lg:sticky lg:top-8">
              <PatternViewer pattern={pattern} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                  {index + 1}
                </span>
                <h2 className="text-2xl font-semibold text-white">{pattern.name}</h2>
              </div>
              <p className="mt-2 text-sm font-medium text-accent">{pattern.tagline}</p>
              <p className="mt-4 text-sm leading-7 text-muted">{pattern.about}</p>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                  Ways it can be mapped
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {pattern.variants.map((variant) => (
                    <div key={variant.name} className="rounded-2xl border border-border bg-background/70 p-4">
                      <p className="text-sm font-semibold text-white">{variant.name}</p>
                      <p className="mt-1.5 text-xs leading-5 text-muted">{variant.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
