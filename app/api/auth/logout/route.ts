import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set({
    name: process.env.SESSION_COOKIE_NAME ?? "rhythians_session",
    value: "",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
  return response;
}
