import Link from "next/link";
import { ArrowRight, ClipboardList, Radio, ShieldCheck, Trophy, Users } from "lucide-react";
import { getTournamentAdminState, tournamentCapState, tournamentTeamSize, type TournamentMode } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

function capLabel(mode: TournamentMode, players: number) {
  const teamSize = tournamentTeamSize(mode);
  const teams = players / teamSize;
  return `${players} players · ${teams} team${teams === 1 ? "" : "s"}`;
}

export default async function AdminTournamentsPage() {
  const initialState = await getTournamentAdminState(null).catch(() => null);
  const nextScheduledId = initialState?.tournaments
    ?.filter((tournament: any) => tournament.status === "scheduled" && tournament.publishedAt)
    .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0]?.id ?? null;
  const state = nextScheduledId
    ? await getTournamentAdminState(nextScheduledId).catch(() => initialState)
    : initialState;
  const selected = state?.selected ?? null;
  const signups = selected?.signups ?? [];
  const activeSignups = signups.filter((signup: any) => signup.status !== "withdrawn");
  const pendingSplits = activeSignups.filter((signup: any) => signup.splitRequestStatus === "pending").length;
  const streamOptIns = activeSignups.filter((signup: any) => signup.streamOptIn).length;
  const waitlisted = activeSignups.filter((signup: any) => signup.status === "waitlisted").length;
  const mode = selected?.tournament?.mode as TournamentMode | undefined;
  const lowerCount = activeSignups.filter((signup: any) => signup.split === "lower").length;
  const higherCount = activeSignups.filter((signup: any) => signup.split === "higher").length;
  const lowerCap = mode ? tournamentCapState(mode, lowerCount) : null;
  const higherCap = mode ? tournamentCapState(mode, higherCount) : null;
  const capacityRows = lowerCap && higherCap ? [
    { label: "Lower", cap: lowerCap, textClass: "text-sky-200", gradientClass: "from-sky-400/80 to-cyan-300/80" },
    { label: "Higher", cap: higherCap, textClass: "text-violet-200", gradientClass: "from-violet-400/80 to-fuchsia-300/80" },
  ] : [];

  return <div className="space-y-6">
    <section className="rounded-3xl border border-border bg-surface/95 p-7 shadow-glow">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Competition control</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">Tournament admin</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">Tournament management is separated into focused workspaces so signup review does not get mixed into live match operations. Use Signups for player records and form answers, and Live Operations for scheduling, map pools, brackets, starting, scoring, and diagnostics.</p>
    </section>

    <section className="grid gap-4 lg:grid-cols-3">
      <Link href="/admin/tournaments/signups" className="group rounded-3xl border border-sky-400/15 bg-sky-400/[0.045] p-6 transition hover:-translate-y-0.5 hover:border-sky-300/30">
        <div className="flex items-start justify-between"><span className="rounded-2xl bg-sky-400/10 p-3 text-sky-200"><ClipboardList size={22} /></span><ArrowRight size={18} className="text-muted transition group-hover:translate-x-1 group-hover:text-white" /></div>
        <h2 className="mt-5 text-xl font-semibold text-white">Signups</h2><p className="mt-2 text-sm leading-6 text-muted">View every entrant, livestream answers, Discord/Rhythia identity, split requests, status, bracket team, seed, and match placement.</p>
      </Link>
      <Link href="/admin/tournaments/live" className="group rounded-3xl border border-fuchsia-400/15 bg-fuchsia-400/[0.045] p-6 transition hover:-translate-y-0.5 hover:border-fuchsia-300/30">
        <div className="flex items-start justify-between"><span className="rounded-2xl bg-fuchsia-400/10 p-3 text-fuchsia-200"><Radio size={22} /></span><ArrowRight size={18} className="text-muted transition group-hover:translate-x-1 group-hover:text-white" /></div>
        <h2 className="mt-5 text-xl font-semibold text-white">Live Operations</h2><p className="mt-2 text-sm leading-6 text-muted">Publish and reschedule events, manage ranked pools and bracket placement, start tournaments, watch both splits live, resolve matches, and run diagnostics.</p>
      </Link>
      <Link href="/tournaments" className="group rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.045] p-6 transition hover:-translate-y-0.5 hover:border-emerald-300/30">
        <div className="flex items-start justify-between"><span className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-200"><Trophy size={22} /></span><ArrowRight size={18} className="text-muted transition group-hover:translate-x-1 group-hover:text-white" /></div>
        <h2 className="mt-5 text-xl font-semibold text-white">Public View</h2><p className="mt-2 text-sm leading-6 text-muted">Open the same tournament page players see to verify signup messaging, map pools, countdowns, and active bracket presentation.</p>
      </Link>
    </section>

    <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Next scheduled tournament</p><h2 className="mt-2 text-2xl font-semibold text-white">{selected?.tournament?.name ?? "No published tournament scheduled"}</h2>{selected?.tournament && <p className="mt-1 text-sm text-muted">{selected.tournament.mode} · {selected.tournament.status} · {new Date(selected.tournament.scheduledAt).toLocaleString()}</p>}</div>{selected?.preflight && <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${selected.preflight.ready ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}><ShieldCheck size={14} />{selected.preflight.ready ? "Preflight ready" : `${selected.preflight.errors.length} preflight blocker${selected.preflight.errors.length === 1 ? "" : "s"}`}</div>}</div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Active signups</p><p className="mt-2 flex items-center gap-2 text-2xl font-bold text-white"><Users size={18} className="text-accent" />{activeSignups.length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Lower</p><p className="mt-2 text-2xl font-bold text-sky-200">{lowerCount}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Higher</p><p className="mt-2 text-2xl font-bold text-violet-200">{higherCount}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Needs attention</p><p className="mt-2 text-2xl font-bold text-amber-200">{pendingSplits + waitlisted}</p><p className="mt-1 text-[11px] text-muted">{pendingSplits} split · {waitlisted} waitlist</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Livestream opt-ins</p><p className="mt-2 text-2xl font-bold text-fuchsia-200">{streamOptIns}</p></div>
      </div>

      {mode && lowerCap && higherCap && <div className="mt-6 rounded-3xl bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-transparent p-5 ring-1 ring-white/10 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Bracket capacity</p><h3 className="mt-1 text-xl font-semibold text-white">Player cap viewer</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Counts use the same cap thresholds that build the real {mode} brackets. Each split locks the largest valid bracket it can support, then grows to the next cap when enough players sign up.</p></div>
          <p className="text-xs text-muted">Caps: {lowerCap.caps.join(" / ")} players per split</p>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {capacityRows.map(({ label, cap, textClass, gradientClass }) => {
            const needed = cap.next == null ? 0 : Math.max(0, cap.next - cap.count);
            const target = cap.next ?? cap.maximum;
            const progress = Math.min(100, Math.round((cap.count / target) * 100));
            return <div key={label} className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/8">
              <div className="flex items-start justify-between gap-4"><div><p className={`text-sm font-bold ${textClass}`}>{label}</p><p className="mt-1 text-2xl font-black text-white">{cap.count}<span className="text-sm font-semibold text-muted"> / {target}</span></p></div><span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-muted">{cap.full ? "Maximum bracket full" : cap.secured > 0 ? `${capLabel(mode, cap.secured)} secured` : `Minimum ${capLabel(mode, cap.minimum)}`}</span></div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full rounded-full bg-gradient-to-r ${gradientClass}`} style={{ width: `${Math.max(cap.count > 0 ? 4 : 0, progress)}%` }} /></div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-muted">{cap.full ? capLabel(mode, cap.maximum) : `Next: ${capLabel(mode, target)}`}</span><span className={needed === 0 ? "font-semibold text-emerald-300" : "font-semibold text-white"}>{cap.full ? "Full" : `${needed} player${needed === 1 ? "" : "s"} needed`}</span></div>
            </div>;
          })}
        </div>
      </div>}
    </section>
  </div>;
}
