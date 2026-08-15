import { settingsSections } from "@/lib/knowledge";

export default function SettingsGuidePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Settings Guide</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Game settings that change your aim</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          Rhythia&rsquo;s settings control how notes are drawn, how far ahead you read them, and how
          your cursor moves. Tuning them changes how easy or hard every map feels. These are the
          settings that make the biggest difference to your gameplay.
        </p>
      </section>

      {settingsSections.map((section, index) => (
        <section key={section.slug} id={section.slug} className="scroll-mt-24 rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
          <div className="flex items-start gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
              {index + 1}
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
              <p className="mt-2 text-sm font-medium text-accent">{section.summary}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {section.content.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className="text-sm leading-7 text-muted">
                {paragraph}
              </p>
            ))}
          </div>

          {section.tips && section.tips.length > 0 ? (
            <div className="mt-6 rounded-3xl border border-border bg-background/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Quick tips</p>
              <ul className="mt-3 space-y-2">
                {section.tips.map((tip, tipIndex) => (
                  <li key={tipIndex} className="flex gap-3 text-sm leading-6 text-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
