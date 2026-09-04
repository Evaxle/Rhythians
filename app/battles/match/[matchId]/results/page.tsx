import { BattleResults } from "@/components/battles/battle-results";

export default async function BattleResultsPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <BattleResults matchId={matchId} />;
}
