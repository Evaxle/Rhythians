import { RankabilityV5Manager } from "@/components/admin/rankability-v5-manager";
import { AutoMapAnalyzer } from "@/components/admin/auto-map-analyzer";
import { ChallengeCategoryManager } from "@/components/admin/challenge-category-manager";
import { MapAdminSearch } from "@/components/map-admin-search";
import { MapCreator } from "@/components/admin/map-creator";
import { AutoImportedMapCleanup } from "@/components/admin/auto-imported-map-cleanup";
import { MapDeleteSearch } from "@/components/admin/map-delete-search";
import { RhythiaMapSync } from "@/components/admin/rhythia-map-sync";
import { getSessionUser, isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminManageMapsPage() {
  const user = await getSessionUser();
  const owner = Boolean(user && isOwner(user));

  return <div className="ui-page space-y-6">
    <section className="ui-page-header">
      <div>
        <p className="ui-eyebrow">Map management</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Manage maps</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          One place for Rhythia synchronization, raw-map analysis, Rankability v5, Difficulty v5,
          Challenge Fit v2, category/level assignment, point eligibility, manual map creation, and cleanup.
          Ranked, unranked, and legacy maps use the same analysis engine; source status only changes point eligibility.
        </p>
      </div>
    </section>

    <AutoMapAnalyzer />
    <RankabilityV5Manager />

    <section className="space-y-4">
      <div>
        <p className="ui-eyebrow">Challenge and category maps</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Assign categories and Levels 1–10</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          This is the same unified assignment system used by the Challenge admin page. Move any synchronized ranked,
          unranked, or legacy source map between Challenge, Jumps, Stream, Tech, Off Grid, and Vibro without maintaining a duplicate map list.
        </p>
      </div>
      <ChallengeCategoryManager isOwner={owner} />
    </section>

    <RhythiaMapSync />
    <MapCreator />
    <AutoImportedMapCleanup />
    <MapDeleteSearch />
    <MapAdminSearch />
  </div>;
}
