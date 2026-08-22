import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth";

export async function AccountSecurityNotice() {
  const user = await getSessionUser().catch(() => null);
  if (!user || user.discordId || user.emailTwoFactorEnabled) return null;

  const message = user.emailVerifiedAt
    ? "Your local Rhythians account still needs email 2FA enabled."
    : user.email
      ? "Your local Rhythians account needs its email verified before email 2FA can protect it."
      : "Your local Rhythians account is not protected by two-factor authentication. Add and verify an email address to protect it.";

  return <div className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-3"><div className="mx-auto flex max-w-7xl items-center gap-3 text-sm"><ShieldAlert className="h-5 w-5 shrink-0 text-amber-300" /><p className="flex-1 leading-6 text-amber-100"><span className="font-semibold text-white">Account security:</span> {message}</p><Link href="/settings" className="shrink-0 rounded-full border border-amber-300/30 px-3 py-1.5 font-semibold text-white transition hover:bg-amber-300/10">Secure account</Link></div></div>;
}
