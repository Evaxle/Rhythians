import { TournamentLiveApp } from "@/components/tournaments/tournament-live-app";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function TournamentLivePage({ params }: Props) {
  const { id } = await params;
  return <TournamentLiveApp tournamentId={id} />;
}
