import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { BattleHistoryApp } from "@/components/battles/battle-history-app";

export const dynamic = "force-dynamic";

export default async function BattleHistoryPage() {
  const user = await getSessionUser();
  if (!user) return <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow"><Trophy className="mx-auto text-accent" size={38} /><h1 className="mt-5 text-3xl font-semibold text-white">Battle history</h1><p className="mt-3 text-sm text-muted">Sign in to view your completed battles.</p><Link href="/login" className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white">Sign in</Link></div>;
  return <BattleHistoryApp />;
}
