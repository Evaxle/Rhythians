import { RankabilityV4Manager } from "@/components/admin/rankability-v4-manager";
import { MapAdminSearch } from "@/components/map-admin-search";
import { MapCreator } from "@/components/admin/map-creator";
import { AutoImportedMapCleanup } from "@/components/admin/auto-imported-map-cleanup";
import { MapDeleteSearch } from "@/components/admin/map-delete-search";
import { RhythiaMapSync } from "@/components/admin/rhythia-map-sync";

export const dynamic = "force-dynamic";

export default function AdminManageMapsPage() {
  return <div className="space-y-8"><section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><div><p className="text-sm uppercase tracking-[0.3em] text-accent">Map management</p><h1 className="mt-3 text-3xl font-semibold text-white">Manage maps</h1><p className="mt-3 text-sm leading-7 text-muted">Synchronize ranked, unranked, and legacy Rhythia maps, analyze their raw patterns, and score competitive map quality with Rankability Analyzer v4. Rankability is independent from point eligibility.</p></div></section><RankabilityV4Manager /><RhythiaMapSync /><MapCreator /><AutoImportedMapCleanup /><MapDeleteSearch /><MapAdminSearch /></div>;
}
