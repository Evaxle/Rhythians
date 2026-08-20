import { MapAdminSearch } from "@/components/map-admin-search";
import { MapCreator } from "@/components/admin/map-creator";
import { AutoImportedMapCleanup } from "@/components/admin/auto-imported-map-cleanup";
import { MapDeleteSearch } from "@/components/admin/map-delete-search";

export const dynamic = "force-dynamic";

export default function AdminManageMapsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Map management</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Add and manage ranked maps</h1>
          <p className="mt-3 text-sm leading-7 text-muted">Upload an SSPM file directly from the admin panel, choose its rating, see the calculated RHP reward, optionally override that reward, and place the map into a category level and/or Challenge level.</p>
        </div>
      </section>
      <MapCreator />
      <AutoImportedMapCleanup />
      <MapDeleteSearch />
      <MapAdminSearch />
    </div>
  );
}
