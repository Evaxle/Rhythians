import { BattleLobbyApp } from "@/components/battles/battle-lobby-app";

export const dynamic = "force-dynamic";

export default async function BattleLobbyPage({ params }: { params: Promise<{ lobbyId: string }> }) {
  const { lobbyId } = await params;
  return <BattleLobbyApp lobbyId={lobbyId} />;
}
