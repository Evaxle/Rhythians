import { RankingSystemControls } from "@/components/admin/ranking-system-controls";
import { loadRankingConfig, previewRankingReset } from "@/lib/ranking-system";
import { getRankInfo } from "@/lib/ranks";

export const dynamic = "force-dynamic";

export default async function AdminRankingPage() {
  const config = await loadRankingConfig();
  const rows = await previewRankingReset(config);
  const ranks = new Map<string, number>();
  for (const row of rows) { const name = getRankInfo(row.newRhp).name; ranks.set(name, (ranks.get(name) ?? 0) + 1); }
  const summary = { users: rows.length, ranks: Object.fromEntries(ranks), min: rows.length ? Math.min(...rows.map(row => row.newRhp)) : 0, max: rows.length ? Math.max(...rows.map(row => row.newRhp)) : 0 };
  return <RankingSystemControls initialConfig={config} initialRows={rows.slice().sort((a, b) => b.newRhp - a.newRhp).slice(0, 100)} initialSummary={summary} />;
}
