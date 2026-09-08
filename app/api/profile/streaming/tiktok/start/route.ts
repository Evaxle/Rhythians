import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createTikTokAuthorization } from "@/lib/tiktok";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/api/auth/login", process.env.NEXT_PUBLIC_SITE_URL ?? "https://rhythians.vercel.app"));
  try {
    const { state, url } = createTikTokAuthorization();
    const response = NextResponse.redirect(url);
    response.cookies.set("rhythians_tiktok_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
    return response;
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "TikTok connection failed.");
    return NextResponse.redirect(new URL(`/profile/${user.profileHandle}?tiktok_error=${message}`, process.env.NEXT_PUBLIC_SITE_URL ?? "https://rhythians.vercel.app"));
  }
}
