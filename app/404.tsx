import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface/95 p-10 text-center shadow-glow">
      <p className="text-sm uppercase tracking-[0.3em] text-accent">404</p>
      <h1 className="mt-4 text-3xl font-semibold text-white">Page not found</h1>
      <p className="mt-3 text-sm leading-7 text-muted">The page you are looking for does not exist or has been moved.</p>
      <Link href="/" className="mt-8 inline-flex items-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2">Return home</Link>
    </div>
  );
}
