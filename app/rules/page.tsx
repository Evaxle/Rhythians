import { Shield } from "lucide-react";
import { rules } from "@/lib/rules";

export default function RulesPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Community Guidelines</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Server rules and expectations</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
            This community is built on improving each other to get everyone better. These rules
            keep every post, comment, and message a positive place to learn and grow together.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="space-y-6">
          {rules.map((rule, index) => (
            <article key={rule.slug} id={rule.slug} className="scroll-mt-24 rounded-3xl border border-border bg-background/70 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-accent/10 text-lg font-semibold text-accent">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="flex items-center gap-3">
                  <Shield size={20} className="shrink-0 text-accent" />
                  <h2 className="text-xl font-semibold text-white">{rule.title}</h2>
                </div>
              </div>
              {rule.description ? (
                <p className="mt-3 text-sm font-medium text-accent">{rule.description}</p>
              ) : null}
              <p className="mt-4 text-sm leading-7 text-muted">{rule.content}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
