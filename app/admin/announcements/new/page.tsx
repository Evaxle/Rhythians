import { AnnouncementForm } from "@/components/announcement-form";

export default function NewAnnouncementPage() {
  return (
    <div className="ui-page space-y-6">
      <section className="ui-page-header">
        <p className="ui-eyebrow">Announcements</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Create announcement</h1>
      </section>
      <div className="ui-panel">
        <AnnouncementForm />
      </div>
    </div>
  );
}
