"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw, Trophy, CheckCircle2, Clock, Flag, Dices, CalendarDays, Gauge, Music2, Timer } from "lucide-react";
import { fairRatingFromStars } from "@/lib/ranks";

type DailyMapData = {
  id: string;
  date: string;
  title: string;
  artist: string | null;
  difficulty: number | null;
  starRating: number;
  noteCount: number | null;
  length: number | null;
  playcount: number | null;
  downloadUrl: string;
  imageUrl: string | null;
  mapperName: string | null;
};

type Beat = {
  points: number;
  accuracy: number | null;
  misses: number | null;
};

type RandomMap = { id: number; title: string };

export function DailyMapCard({
  dailyMap,
  initialBeat,
  userRhp,
  streak,
  rankName,
  randomMaps,
}: {
  dailyMap: DailyMapData;
  initialBeat: Beat | null;
  userRhp: number;
  streak: number;
  rankName: string;
  randomMaps: RandomMap[];
}) {
  const [beat, setBeat] = useState<Beat | null>(initialBeat);
  const [rhp, setRhp] = useState(userRhp);
  const [currentStreak, setCurrentStreak] = useState(streak);
  const [state, setState] = useState<"idle" | "checking" | "found" | "not_found">(initialBeat ? "found" : "idle");
  const [message, setMessage] = useState("");
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent">("idle");
  const [randomResult, setRandomResult] = useState<RandomMap | null>(null);

  type CheckResult =
    | { ok: true; status: "beat" | "already" | "not_beat"; points: number; streak?: number }
    | { ok: false; error: string };

  async function runCheck(): Promise<CheckResult> {
    try {
      const response = await fetch("/api/daily/check", { method: "POST" });
      const data = await response.json();
      if (!response.ok) return { ok: false, error: data.error ?? "Unable to check your scores." };
      if (data.status === "beat") return { ok: true, status: "beat", points: data.points, streak: data.streak };
      if (data.status === "already") return { ok: true, status: "already", points: 0, streak: data.streak };
      if (data.status === "no_profile") return { ok: false, error: "Link your Rhythia account to participate in the daily map." };
      return { ok: true, status: "not_beat", points: 0 };
    } catch {
      return { ok: false, error: "Unable to reach the server. Try again." };
    }
  }

  function applyResult(result: CheckResult) {
    if (!result.ok) {
      setState("idle");
      setMessage(result.error);
      return;
    }
    if (result.status === "beat") {
      setBeat({ points: result.points, accuracy: null, misses: null });
      setRhp((value) => value + result.points);
      if (result.streak != null) setCurrentStreak(result.streak);
      setState("found");
      setMessage(`Great job! You earned ${result.points} RHP for beating today's map.`);
    } else if (result.status === "already") {
      setState("found");
      setMessage("You already claimed today's daily map reward.");
    } else {
      setState("not_found");
      setMessage("No passing score for today's map found yet. Beat it in Rhythia and check again.");
    }
  }

  function handleCheck() {
    setState("checking");
    setMessage("");
    void runCheck().then(applyResult);
  }

  useEffect(() => {
    if (!initialBeat) {
      void runCheck().then(applyResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRandomize() {
    if (randomMaps.length === 0) return;
    const pick = randomMaps[Math.floor(Math.random() * randomMaps.length)];
    setRandomResult(pick);
  }

  async function submitReport() {
    setReportState("sending");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "daily_map",
          targetId: dailyMap.id,
          reason: "Broken daily map",
          description: null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send report.");
      setReportState("sent");
      setMessage("Report sent. An admin will review the map and refresh it if needed.");
    } catch (err) {
      setReportState("idle");
      setMessage(err instanceof Error ? err.message : "Could not send report.");
    }
  }

  const difficultyLabel = dailyMap.difficulty != null ? `${dailyMap.difficulty}/5` : "—";
  const lengthLabel = dailyMap.length != null
    ? `${Math.floor(dailyMap.length / 60_000)}:${String(Math.round((dailyMap.length % 60_000) / 1000)).padStart(2, "0")}`
    : "—";
  const dateLabel = new Date(dailyMap.date + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-accent">
                <CalendarDays size={16} /> Daily map
              </p>
              <p className="mt-2 text-sm text-muted">{dailyMap.artist ?? "Unknown artist"}</p>
              <h2 className="mt-1 truncate text-2xl font-semibold text-white">{dailyMap.title}</h2>
              <p className="mt-1 text-xs text-muted">Mapped by {dailyMap.mapperName ?? "Unknown"}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm font-semibold text-amber-300">
              {fairRatingFromStars(dailyMap.starRating).toFixed(2)} rating
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-muted"><Gauge size={12} /> Difficulty</p>
              <p className="mt-2 text-lg font-semibold text-white">{difficultyLabel}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-muted"><Music2 size={12} /> Notes</p>
              <p className="mt-2 text-lg font-semibold text-white">{dailyMap.noteCount?.toLocaleString() ?? "—"}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-muted"><Timer size={12} /> Length</p>
              <p className="mt-2 text-lg font-semibold text-white">{lengthLabel}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-muted"><Clock size={12} /> Date</p>
              <p className="mt-2 text-lg font-semibold text-white">{dateLabel.split(",")[0]}</p>
            </div>
          </div>

          {dailyMap.imageUrl && (
            <img
              src={dailyMap.imageUrl}
              alt={dailyMap.title}
              className="mt-5 aspect-[16/9] w-full rounded-2xl border border-border object-cover"
              onError={(event) => ((event.currentTarget as HTMLImageElement).style.display = "none")}
            />
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={dailyMap.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20"
            >
              <Download size={15} /> Download map
            </a>
            <button
              type="button"
              onClick={handleCheck}
              disabled={state === "checking"}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-60"
            >
              <RefreshCw size={15} className={state === "checking" ? "animate-spin" : ""} />
              {state === "checking" ? "Checking..." : "Check my score"}
            </button>
            <button
              type="button"
              onClick={() => void submitReport()}
              disabled={reportState === "sending"}
              className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-400/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400/20 disabled:opacity-60"
            >
              <Flag size={15} /> {reportState === "sending" ? "Reporting..." : "Report broken map"}
            </button>
          </div>

          {beat ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-300" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">Completed</p>
                <p className="mt-1 text-sm text-emerald-200/90">
                  You earned <span className="font-semibold">{beat.points} RHP</span>
                  {beat.accuracy != null && <> at {beat.accuracy.toFixed(2)}% accuracy</>}
                  {beat.misses != null && <> with {beat.misses} miss{beat.misses === 1 ? "" : "es"}</>}.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3">
              <Clock size={18} className="shrink-0 text-muted" />
              <div>
                <p className="text-sm font-semibold text-white">Not beaten yet</p>
                <p className="mt-1 text-sm text-muted">
                  Beat this map in Rhythia with a passing score, then come back and check to earn Rhythian Points.
                </p>
              </div>
            </div>
          )}

          {message && state !== "found" && (
            <p className="mt-3 rounded-2xl border border-border bg-background/70 p-3 text-sm text-amber-200">{message}</p>
          )}
          {state === "found" && message && (
            <p className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>
          )}
          {reportState === "sent" && !message && (
            <p className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
              Report sent. An admin will review it and refresh the map if needed.
            </p>
          )}

          <p className="mt-5 text-center text-xs text-muted">
            New map every day at midnight UTC · Maps reset each month and can be picked again.
          </p>
        </section>

        <section className="flex h-fit flex-col rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
          <p className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-accent">
            <Dices size={16} /> Map randomizer
          </p>
          <p className="mt-2 text-sm text-muted">
            Explore the current ranked map pool and open a random map directly in Rhythia.
          </p>

          <button
            type="button"
            onClick={handleRandomize}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2"
          >
            <Dices size={16} /> Randomize map
          </button>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">www.rhythia.com/maps/</p>
              <p className="mt-2 text-xl font-semibold text-white">{randomResult ? randomResult.id : "-"}</p>
            </div>
            {randomResult && (
              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Map</p>
                <p className="mt-2 truncate text-sm font-semibold text-white" title={randomResult.title}>
                  {randomResult.title}
                </p>
              </div>
            )}
            <a
              id="card2-map-link"
              href={randomResult ? `https://www.rhythia.com/maps/${randomResult.id}` : "#"}
              target="_blank"
              rel="noreferrer"
              className={`block text-center text-sm font-semibold underline ${randomResult ? "text-accent hover:text-white" : "pointer-events-none text-muted"}`}
            >
              Click to open in browser
            </a>
          </div>

          <p className="mt-5 text-xs text-muted">
            Links leading to a blank page usually means that the map has been deleted.
          </p>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 rounded-3xl border border-border bg-surface/60 px-5 py-3 text-sm text-muted">
        <span>Made by <span className="font-semibold text-white">LC727</span> for Rhythians</span>
        <span className="text-border">·</span>
        <Link href="/leaderboards" className="inline-flex items-center gap-1 font-semibold text-accent hover:text-white">
          <Trophy size={14} /> View leaderboards
        </Link>
        <span className="text-border">·</span>
        <span>{rankName} rank · {currentStreak} day streak · {rhp.toLocaleString()} RHP</span>
      </div>
    </div>
  );
}