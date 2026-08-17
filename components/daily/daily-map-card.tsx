"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw, Star, Trophy, CheckCircle2, Clock, Flag, Dices } from "lucide-react";

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

const cardStyle = {
  background: "#12182B",
  borderRadius: 10,
  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
} as const;

const btnStyle = {
  backgroundColor: "#3476c2",
  color: "#ffffff",
  border: "2px solid #000000",
  borderRadius: 5,
  cursor: "pointer",
  width: "100%",
} as const;

const resultItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#ffffff",
  padding: "10px 14px",
  borderRadius: 6,
  border: "2px solid #000000",
} as const;

export function DailyMapCard({
  dailyMap,
  initialBeat,
  userRhp,
  randomMaps,
}: {
  dailyMap: DailyMapData;
  initialBeat: Beat | null;
  userRhp: number;
  randomMaps: RandomMap[];
}) {
  const [beat, setBeat] = useState<Beat | null>(initialBeat);
  const [rhp, setRhp] = useState(userRhp);
  const [state, setState] = useState<"idle" | "checking" | "found" | "not_found">(initialBeat ? "found" : "idle");
  const [message, setMessage] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Broken or misleading content");
  const [reportDetail, setReportDetail] = useState("");
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent">("idle");
  const [randomResult, setRandomResult] = useState<RandomMap | null>(null);

  type CheckResult =
    | { ok: true; status: "beat" | "already" | "not_beat"; points: number }
    | { ok: false; error: string };

  async function runCheck(): Promise<CheckResult> {
    try {
      const response = await fetch("/api/daily/check", { method: "POST" });
      const data = await response.json();
      if (!response.ok) return { ok: false, error: data.error ?? "Unable to check your scores." };
      if (data.status === "beat") return { ok: true, status: "beat", points: data.points };
      if (data.status === "already") return { ok: true, status: "already", points: 0 };
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
          reason: reportReason,
          description: reportDetail.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send report.");
      setReportState("sent");
      setReportOpen(false);
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
      <div className="flex flex-wrap justify-center gap-10">
        <div style={cardStyle} className="w-full max-w-xl p-8">
          <h2 style={{ textAlign: "center", marginTop: 0, color: "#ffffff" }}>Daily Map</h2>

          <p style={{ textAlign: "center", color: "#9aa4bf", fontSize: "0.9rem", marginBottom: 16 }}>
            {dateLabel} · {rhp.toLocaleString()} RHP
          </p>

          <div className="results-grid" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={resultItemStyle}>
              <span className="label" style={{ fontWeight: 700, color: "#000", fontSize: "0.85rem" }}>Map</span>
              <span className="value" style={{ fontWeight: 700, color: "#000", fontSize: "0.9rem", textAlign: "right" }}>{dailyMap.title}</span>
            </div>
            <div style={resultItemStyle}>
              <span className="label" style={{ fontWeight: 700, color: "#000", fontSize: "0.85rem" }}>Artist</span>
              <span className="value" style={{ fontWeight: 700, color: "#000", fontSize: "0.9rem", textAlign: "right" }}>{dailyMap.artist ?? "—"}</span>
            </div>
            <div style={resultItemStyle}>
              <span className="label" style={{ fontWeight: 700, color: "#000", fontSize: "0.85rem" }}>Stars</span>
              <span className="value" style={{ fontWeight: 700, color: "#000", fontSize: "0.9rem" }}>
                <Star size={14} style={{ color: "#d4a017", verticalAlign: -2 }} /> {dailyMap.starRating.toFixed(2)}
              </span>
            </div>
            <div style={resultItemStyle}>
              <span className="label" style={{ fontWeight: 700, color: "#000", fontSize: "0.85rem" }}>Difficulty</span>
              <span className="value" style={{ fontWeight: 700, color: "#000", fontSize: "0.9rem" }}>{difficultyLabel}</span>
            </div>
            <div style={resultItemStyle}>
              <span className="label" style={{ fontWeight: 700, color: "#000", fontSize: "0.85rem" }}>Notes</span>
              <span className="value" style={{ fontWeight: 700, color: "#000", fontSize: "0.9rem" }}>{dailyMap.noteCount?.toLocaleString() ?? "—"}</span>
            </div>
            <div style={resultItemStyle}>
              <span className="label" style={{ fontWeight: 700, color: "#000", fontSize: "0.85rem" }}>Length</span>
              <span className="value" style={{ fontWeight: 700, color: "#000", fontSize: "0.9rem" }}>{lengthLabel}</span>
            </div>
          </div>

          {dailyMap.imageUrl && (
            <img
              src={dailyMap.imageUrl}
              alt={dailyMap.title}
              className="mt-4 aspect-[16/9] w-full rounded-lg border-2 border-black object-cover"
              onError={(event) => ((event.currentTarget as HTMLImageElement).style.display = "none")}
            />
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={dailyMap.downloadUrl}
              target="_blank"
              rel="noreferrer"
              style={{ ...btnStyle, width: "auto", padding: "10px 18px", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Download size={15} /> Download map
            </a>
            <button
              type="button"
              onClick={handleCheck}
              disabled={state === "checking"}
              style={{ ...btnStyle, width: "auto", padding: "10px 18px", display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 0 }}
            >
              <RefreshCw size={15} className={state === "checking" ? "animate-spin" : ""} />
              {state === "checking" ? "Checking..." : "Check my score"}
            </button>
            <button
              type="button"
              onClick={() => setReportOpen((value) => !value)}
              style={{ ...btnStyle, width: "auto", padding: "10px 18px", display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 0, backgroundColor: "#8a3a3a" }}
            >
              <Flag size={15} /> Report broken map
            </button>
          </div>

          {reportOpen && (
            <div className="mt-4 rounded-lg border-2 border-black bg-white/5 p-4">
              <p style={{ color: "#fff", fontWeight: 600, fontSize: "0.85rem", marginBottom: 8 }}>Report this daily map</p>
              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                className="w-full rounded border-2 border-black bg-white px-3 py-2 text-sm text-black"
              >
                <option>Broken or misleading content</option>
                <option>Spam or advertising</option>
                <option>Inappropriate content</option>
                <option>Other</option>
              </select>
              <textarea
                value={reportDetail}
                onChange={(event) => setReportDetail(event.target.value)}
                rows={2}
                placeholder="What's wrong with the map? (optional)"
                className="mt-2 w-full rounded border-2 border-black bg-white px-3 py-2 text-sm text-black"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void submitReport()}
                  disabled={reportState === "sending"}
                  style={{ ...btnStyle, width: "auto", padding: "8px 16px", marginBottom: 0 }}
                >
                  {reportState === "sending" ? "Sending..." : "Send report"}
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  style={{ ...btnStyle, width: "auto", padding: "8px 16px", marginBottom: 0, backgroundColor: "#555" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {beat ? (
            <div className="mt-4 rounded-lg border-2 border-[#2e7d4f] bg-[#1e3a2c] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#6ee7a0" }}>
                <CheckCircle2 size={16} /> Completed
              </p>
              <p className="mt-2 text-sm" style={{ color: "#b7f2cd" }}>
                You earned <span className="font-semibold">{beat.points} RHP</span>
                {beat.accuracy != null && <> at {beat.accuracy.toFixed(2)}% accuracy</>}
                {beat.misses != null && <> with {beat.misses} miss{beat.misses === 1 ? "" : "es"}</>}.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border-2 border-[#3a3f52] bg-[#161b2e] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <Clock size={16} /> Not beaten yet
              </p>
              <p className="mt-2 text-sm" style={{ color: "#9aa4bf" }}>
                Beat this map in Rhythia with a passing score, then come back and check to earn Rhythian Points.
              </p>
            </div>
          )}

          {message && state !== "found" && (
            <p className="mt-3 rounded-lg border-2 border-[#3a3f52] bg-[#161b2e] p-3 text-sm" style={{ color: "#c9d1e5" }}>{message}</p>
          )}
          {state === "found" && message && (
            <p className="mt-3 rounded-lg border-2 border-[#2e7d4f] bg-[#1e3a2c] p-3 text-sm" style={{ color: "#b7f2cd" }}>{message}</p>
          )}
          {reportState === "sent" && (
            <p className="mt-3 rounded-lg border-2 border-[#2e7d4f] bg-[#1e3a2c] p-3 text-sm" style={{ color: "#b7f2cd" }}>
              Report sent. An admin will review it and refresh the map if needed.
            </p>
          )}

          <p style={{ color: "#9aa4bf", fontSize: "0.75rem", textAlign: "center", marginTop: 16 }}>
            New map every day at midnight UTC · Maps reset each month and can be picked again.
          </p>
        </div>

        <div style={cardStyle} className="w-full max-w-sm p-8">
          <h2 style={{ textAlign: "center", marginTop: 0, color: "#ffffff" }}>Map Randomizer</h2>

          <button type="button" onClick={handleRandomize} style={{ ...btnStyle, marginBottom: 20 }}>
            <Dices size={18} style={{ verticalAlign: -3, marginRight: 6 }} /> Randomize Map
          </button>

          <div className="results-grid" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={resultItemStyle}>
              <span className="label" style={{ fontWeight: 700, color: "#000", fontSize: "0.85rem" }}>www.rhythia.com/maps/</span>
              <span className="value" style={{ fontWeight: 700, color: "#000", fontSize: "1rem" }}>{randomResult ? randomResult.id : "-"}</span>
            </div>
            {randomResult && (
              <div style={resultItemStyle}>
                <span className="label" style={{ fontWeight: 700, color: "#000", fontSize: "0.85rem" }}>Map</span>
                <span className="value" style={{ fontWeight: 700, color: "#000", fontSize: "0.8rem", textAlign: "right", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{randomResult.title}</span>
              </div>
            )}
            <a
              id="card2-map-link"
              href={randomResult ? `https://www.rhythia.com/maps/${randomResult.id}` : "#"}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#64b5f6", textDecoration: "underline", textAlign: "center" }}
            >
              Click to open in browser
            </a>
          </div>

          <p style={{ color: "#ffffff", fontSize: "0.8rem", textAlign: "center", marginTop: 12 }}>
            Links leading to a blank page usually means that the map has been deleted
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 rounded-xl border border-border bg-surface/60 px-5 py-3 text-sm text-muted">
        <span>Made by <span className="font-semibold text-white">LC727</span> for Rhythians</span>
        <span className="text-border">·</span>
        <Link href="/leaderboards" className="inline-flex items-center gap-1 font-semibold text-accent hover:text-white">
          <Trophy size={14} /> View leaderboards
        </Link>
        <span className="text-border">·</span>
        <span>Earn {rhp.toLocaleString()} RHP</span>
      </div>
    </div>
  );
}