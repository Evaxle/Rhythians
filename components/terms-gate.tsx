"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";

export function TermsGate({ required }: { required: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(required && pathname !== "/terms");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open || pathname === "/terms") return null;

  async function accept() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/terms/accept", { method: "POST" });
      if (!response.ok) throw new Error("Unable to record acceptance.");
      setOpen(false);
      window.location.reload();
    } catch {
      setError("We could not save your acceptance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl border border-border bg-background p-3">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Please review the Terms of Service</h2>
            <p className="mt-2 text-sm leading-6 text-muted">You need to accept the current Rhythians Terms of Service before continuing to use your account.</p>
          </div>
        </div>
        <div className="mt-6 rounded-xl border border-border bg-background/60 p-4 text-sm leading-6 text-muted">
          By selecting <span className="font-semibold text-white">I Agree</span>, you confirm that you have read and agree to the current Terms of Service. You can review the complete terms at any time from the footer.
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a href="/terms" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-white hover:underline">
            Read the complete Terms of Service <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={accept}
            disabled={submitting}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving..." : "I Agree"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}
