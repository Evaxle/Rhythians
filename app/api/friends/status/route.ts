import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getFriendStatus } from "@/lib/friends";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }
  if (userId === user.id) {
    return NextResponse.json({ status: "self" });
  }

  const status = await getFriendStatus(user.id, userId);
  return NextResponse.json({ status });
}
