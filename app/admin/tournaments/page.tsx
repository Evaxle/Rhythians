import Link from "next/link";
import { ArrowRight, ClipboardList, Radio, ShieldCheck, Trophy, Users } from "lucide-react";
import { getTournamentAdminState } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

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
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Lower</p><p className="mt-2 text-2xl font-bold text-sky-200">{activeSignups.filter((signup: any) => signup.split === "lower").length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Higher</p><p className="mt-2 text-2xl font-bold text-violet-200">{activeSignups.filter((signup: any) => signup.split === "higher").length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Needs attention</p><p className="mt-2 text-2xl font-bold text-amber-200">{pendingSplits + waitlisted}</p><p className="mt-1 text-[11px] text-muted">{pendingSplits} split · {waitlisted} waitlist</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Livestream opt-ins</p><p className="mt-2 text-2xl font-bold text-fuchsia-200">{streamOptIns}</p></div>
      </div>
    </section>
  </div>;
}
