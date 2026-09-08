import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createTwitchAuthorization } from "@/lib/twitch";

export async function GET() {
  const user = await getSessionUser();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rhythians.vercel.app";
  if (!user) return NextResponse.redirect(new URL("/api/auth/login", site));
  try {
    const { state, url } = createTwitchAuthorization();
    const response = NextResponse.redirect(url);
    response.cookies.set("rhythians_twitch_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
    return response;
  } catch (error) {
    const profile = new URL(`/profile/${user.profileHandle}`, site);
    profile.searchParams.set("twitch_error", error instanceof Error ? error.message : "Twitch connection failed.");
    return NextResponse.redirect(profile);
  }
}
