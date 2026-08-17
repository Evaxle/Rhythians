import { getRankInfo } from "@/lib/ranks";
import { RankBadge } from "@/components/rank-badge";

export function RankProgress({ rhp, globalRank }: { rhp: number; globalRank: number | null }) {
  const rank = getRankInfo(rhp);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <RankBadge rank={rank} globalRank={globalRank} size="lg" />
        <span className="text-lg font-semibold text-white">{rhp.toLocaleString()} RHP</span>
      </div>

      {rank.isUnnamed ? (
        <p className="text-sm leading-6 text-muted">
          You are in the <span style={{ color: rank.color }} className="font-semibold">Unnamed</span> rank — the peak of
          the ladder. Your global position:{" "}
          <span className="font-semibold text-white">{globalRank != null ? `#${globalRank.toLocaleString()}` : "—"}</span>
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                Tier {rank.tier} of 5
                {rank.nextRankStart != null && (
                  <span className="ml-2 text-muted">
                    Next tier at {rank.nextTierStart.toLocaleString()} RHP
                  </span>
                )}
              </span>
              <span>
                {Math.round(rank.progressToNextTier * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${rank.progressToNextTier * 100}%`, backgroundColor: rank.color }}
              />
            </div>
          </div>

          {rank.nextRankStart != null && (
            <p className="text-xs text-muted">
              Next rank at{" "}
              <span className="font-semibold text-white">{rank.nextRankStart.toLocaleString()} RHP</span>
              {" "}({rank.nextRankStart - rhp >= 0 ? (rank.nextRankStart - rhp).toLocaleString() : 0} RHP to go)
            </p>
          )}
        </div>
      )}
    </div>
  );
}