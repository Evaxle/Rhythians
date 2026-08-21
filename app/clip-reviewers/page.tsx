import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import CompletionClipReviewPage from "@/app/admin/completion-clips/page";

export const dynamic = "force-dynamic";

export default async function ClipReviewersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!(await canAccessAdmin(user))) redirect("/");
  return <CompletionClipReviewPage />;
}
