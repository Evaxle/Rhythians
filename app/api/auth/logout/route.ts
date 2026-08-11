import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.redirect("/");
  response.cookies.set({
    name: process.env.SESSION_COOKIE_NAME ?? "rhythians_session",
    value: "",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
  return response;
}
