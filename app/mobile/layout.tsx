import type { Metadata, Viewport } from "next";
import { MobileShell } from "@/components/mobile-shell";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin, canAccessRhythiaReview } from "@/lib/admin-access";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0f19",
};

export const metadata: Metadata = {
  title: "Rhythians Mobile",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rhythians",
  },
};

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const [canReview, canAdmin] = user
    ? await Promise.all([canAccessRhythiaReview(user), canAccessAdmin(user)])
    : [false, false];
  const mobileUser = user
    ? { username: user.username, displayName: user.displayName, profileHandle: user.profileHandle, avatar: user.avatar, discordId: user.discordId }
    : null;
  return <MobileShell canReview={canReview} canAdmin={canAdmin} user={mobileUser}>{children}</MobileShell>;
}
