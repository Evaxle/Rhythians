import { getSessionUser, isOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProfileOwnerEditor } from "@/components/profile-owner-editor";

type Props = {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
};

export default async function ProfileLayout({ children, params }: Props) {
  const currentUser = await getSessionUser();
  if (!isOwner(currentUser)) return <>{children}</>;

  const { username } = await params;
  const target = await prisma.user.findFirst({
    where: { profileHandle: username },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileHandle: true,
      bio: true,
      website: true,
      rhp: true,
      rhythiaProfile: { select: { profileUrl: true, username: true } },
    },
  });

  if (!target) return <>{children}</>;

  const titleRows = await prisma.$queryRawUnsafe<Array<{ title: string; color: string; neon: boolean }>>(
    'SELECT "title","color","neon" FROM "UserProfileTitle" WHERE "userId"=$1 LIMIT 1',
    target.id,
  ).catch(() => []);
  const title = titleRows[0] ?? null;

  return <>
    <ProfileOwnerEditor
      userId={target.id}
      username={target.username}
      displayName={target.displayName}
      profileHandle={target.profileHandle}
      bio={target.bio}
      website={target.website}
      rhp={target.rhp}
      title={title?.title ?? null}
      titleColor={title?.color ?? null}
      titleNeon={title?.neon ?? false}
      rhythiaProfileUrl={target.rhythiaProfile?.profileUrl ?? null}
      rhythiaUsername={target.rhythiaProfile?.username ?? null}
    />
    {children}
  </>;
}
