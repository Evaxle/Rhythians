export default function SettingsPage() {
  return (
    <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <h1 className="text-3xl font-semibold text-white">Settings</h1>
      <p className="mt-3 text-sm leading-7 text-muted">Manage your profile preferences, privacy settings, and connected Discord account.</p>
      <div className="mt-8 rounded-3xl border border-dashed border-border bg-background/70 p-8 text-center text-sm text-muted">
        User settings will be available after sign in.
      </div>
    </div>
  );
}
