import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function ProfileByIdPage({ params }: Props) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { profileHandle: true } });
  if (!user?.profileHandle) notFound();
  redirect(`/profile/${encodeURIComponent(user.profileHandle)}`);
}
