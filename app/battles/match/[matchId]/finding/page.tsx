import { BattleFinding } from "@/components/battles/battle-finding";

export default async function BattleFindingPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <BattleFinding matchId={matchId} />;
}
