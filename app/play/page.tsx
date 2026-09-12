import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RhythianBrowserGame } from "@/components/game/rhythian-browser-game";

export const dynamic = "force-dynamic";

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ local?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/play");
  const params = await searchParams;
  if (!params.local) redirect("/maps");
  return <RhythianBrowserGame localId={params.local} />;
}
