import { BattleMatchApp } from "@/components/battles/battle-match-app";

export const dynamic = "force-dynamic";

export default async function BattleMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <BattleMatchApp matchId={matchId} />;
}
