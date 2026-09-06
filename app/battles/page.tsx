import Link from "next/link";
import { Swords } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { BattlesApp } from "@/components/battles/battles-app";
import { RbpBattleDashboard } from "@/components/battles/rbp-battle-dashboard";
import { BattlePageFrame } from "@/components/battles/battle-page-frame";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function BattlesPage() {
  const user = await getSessionUser();
  if (!user) return <Card className="mx-auto max-w-2xl text-center"><CardContent className="p-10"><Swords className="mx-auto text-accent" size={38} /><h1 className="mt-5 text-3xl font-semibold text-white">Battles</h1><p className="mt-3 text-sm text-muted">Sign in to join battles, create lobbies, and challenge other Rhythians.</p><Button asChild size="lg" className="mt-6 rounded-full"><Link href="/login">Sign in</Link></Button></CardContent></Card>;
  return <BattlePageFrame><RbpBattleDashboard userId={user.id} /><BattlesApp /></BattlePageFrame>;
}
