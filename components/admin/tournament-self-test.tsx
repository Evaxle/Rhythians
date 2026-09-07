"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

type Check = { name: string; status: "pass" | "warn" | "fail"; detail: string };
type TestResult = { ok: boolean; ranAt: string; durationMs: number; summary: { passed: number; warnings: number; failed: number; total: number }; checks: Check[] };

export function TournamentSelfTest() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/tournaments", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load tournaments.");
        setTournaments(data.tournaments ?? []);
        setSelectedId(data.selected?.tournament?.id ?? data.tournaments?.[0]?.id ?? "");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load tournaments.");
      }
    })();
  }, []);

  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/tournaments/self-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: selectedId || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Tournament self-test failed.");
      setResult(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tournament self-test failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-accent"><ShieldCheck size={15} /> Tournament diagnostics</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Read-only tournament self-test</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Checks bracket math, split configuration, required database tables and columns, ranked map-pool integrity, signup form consistency, active BattleMatch linkage, duplicate bracket players, and the selected tournament preflight. It does not create, start, score, cancel, or delete a real tournament.</p>
        </div>
        <div className="flex min-w-[260px] flex-col gap-2 sm:flex-row lg:flex-col">
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="min-w-0 rounded-2xl border border-white/10 bg-[#101629] px-4 py-3 text-sm text-white">
            <option value="">Global checks only</option>
            {tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name} · {tournament.status}</option>)}
          </select>
          <button disabled={busy} onClick={() => void run()} className="ui-button justify-center bg-accent text-white disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}Run self-test</button>
        </div>
      </div>

      {message && <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{message}</p>}

      {result && <div className="mt-6 space-y-4">
        <div className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-4 ${result.ok ? "border-emerald-400/20 bg-emerald-400/[0.05]" : "border-rose-400/20 bg-rose-400/[0.05]"}`}>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Overall</p><p className={`mt-1 text-lg font-bold ${result.ok ? "text-emerald-200" : "text-rose-200"}`}>{result.ok ? "Passed" : "Needs attention"}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Passed</p><p className="mt-1 text-lg font-bold text-emerald-200">{result.summary.passed}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Warnings</p><p className="mt-1 text-lg font-bold text-amber-200">{result.summary.warnings}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Failed</p><p className="mt-1 text-lg font-bold text-rose-200">{result.summary.failed}</p></div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {result.checks.map((check) => <div key={check.name} className="flex gap-3 rounded-2xl border border-white/10 bg-black/15 p-4">
            {check.status === "pass" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-300" /> : check.status === "warn" ? <CircleAlert size={18} className="mt-0.5 shrink-0 text-amber-300" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-rose-300" />}
            <div className="min-w-0"><p className="font-semibold text-white">{check.name}</p><p className="mt-1 text-xs leading-5 text-muted">{check.detail}</p></div>
          </div>)}
        </div>
        <p className="text-right text-xs text-muted">Last run {new Date(result.ranAt).toLocaleString()} · {result.durationMs} ms</p>
      </div>}
    </section>
  );
}
