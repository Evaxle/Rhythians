import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Props = { params: Promise<{ userId: string }> };

export async function DELETE(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { userId } = await params;
  if (userId === user.id) {
    return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  }

  await prisma.friendRequest.deleteMany({
    where: {
      OR: [
        { senderId: user.id, receiverId: userId, status: "accepted" },
        { senderId: userId, receiverId: user.id, status: "accepted" },
      ],
    },
  });

  return NextResponse.json({ status: "none" });
}
