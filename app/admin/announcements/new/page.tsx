import { AnnouncementForm } from "@/components/announcement-form";

export default function NewAnnouncementPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Announcements</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Create announcement</h1>
      </section>
      <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <AnnouncementForm />
      </div>
    </div>
  );
}
