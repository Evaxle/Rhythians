import { RbpProfileCard } from "@/components/profile/rbp-profile-card";
import { prisma } from "@/lib/db";

export default async function ProfileLayout({ children, params }: { children: React.ReactNode; params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await prisma.user.findFirst({ where: { profileHandle: username }, select: { id: true } });
  if (!user) return <>{children}</>;
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start"><main className="min-w-0">{children}</main><aside className="xl:sticky xl:top-24"><RbpProfileCard userId={user.id} /></aside></div>;
}
