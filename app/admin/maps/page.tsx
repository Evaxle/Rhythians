import { MapAdminSearch } from "@/components/map-admin-search";

export const dynamic = "force-dynamic";

export default function AdminManageMapsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Map management</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Search maps by ID</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Look up an approved map to view its details, change its rating, remove individual scores,
            or delete it. Editing the rating immediately changes which ranks can play it.
          </p>
        </div>
      </section>

      <MapAdminSearch />
    </div>
  );
}