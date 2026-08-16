import { ClipAdminSearch } from "@/components/clip-admin-search";

export const dynamic = "force-dynamic";

export default function AdminManageClipsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Clip management</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Search clips by ID</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Look up a clip by its ID to see details like who uploaded it and who approved it, or delete it.
          </p>
        </div>
      </section>

      <ClipAdminSearch />
    </div>
  );
}