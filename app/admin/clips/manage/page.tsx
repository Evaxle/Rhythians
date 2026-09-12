import { ClipAdminSearch } from "@/components/clip-admin-search";

export const dynamic = "force-dynamic";

export default function AdminManageClipsPage() {
  return (
    <div className="ui-page space-y-6">
      <section className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Clip management</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Search clips by ID</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Look up a clip by its ID to see details like who uploaded it and who approved it, or delete it.
          </p>
        </div>
      </section>

      <ClipAdminSearch />
    </div>
  );
}