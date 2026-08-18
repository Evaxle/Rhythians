import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import ClipSubmitForm from "@/components/clip-submit-form";

export const dynamic = "force-dynamic";

export default async function ClipSubmitPage() {
  const user = await getSessionUser();
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Submit a clip</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Share your best community moment</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Upload a clip and submit it for review. Approved clips appear publicly on the community feed.</p>
          </div>
        </div>
      </section>
      {user ? (
        <ClipSubmitForm tags={tags} />
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-background/70 p-8 text-center text-sm text-muted">
          <p className="text-lg font-semibold text-white">Sign in with Discord to submit a clip.</p>
          <p className="mt-3">Clip submission is available once you are authenticated with your Discord account.</p>
          <div className="mt-6 flex justify-center">
            <Link href="/login" className="inline-flex items-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent2">
              Sign in with Discord
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
