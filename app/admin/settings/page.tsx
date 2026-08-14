import { MessageSettings } from "@/components/admin/message-settings";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <h1 className="text-3xl font-semibold text-white">System settings</h1>
        <p className="mt-3 text-sm leading-7 text-muted">Configure branding, open graph metadata, feature flags, and Discord integration settings.</p>
        <div className="mt-8 rounded-3xl border border-dashed border-border bg-background/70 p-8 text-center text-sm text-muted">
          Settings management will be available once backend config storage is enabled.
        </div>
      </div>
      <MessageSettings />
    </div>
  );
}
