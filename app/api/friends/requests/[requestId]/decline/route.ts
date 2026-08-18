import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Props = { params: Promise<{ requestId: string }> };

export async function POST(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { requestId } = await params;

  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request || request.receiverId !== user.id) {
    return NextResponse.json({ error: "Friend request not found." }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "This request has already been responded to." }, { status: 400 });
  }

  await prisma.friendRequest.delete({ where: { id: requestId } });

  return NextResponse.json({ status: "none" });
}
