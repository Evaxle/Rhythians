import { BattleChat } from "@/components/battles/battle-chat";
import { BattleMatchApp } from "@/components/battles/battle-match-app";
import { RbpBattleOverlay } from "@/components/battles/rbp-battle-overlay";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BattleMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const user = await getSessionUser();
  if (!user) return null;
  return <div className="space-y-5"><BattleMatchApp matchId={matchId} /><RbpBattleOverlay matchId={matchId} /><BattleChat matchId={matchId} currentUserId={user.id} /></div>;
}
