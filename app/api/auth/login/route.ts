import { NextResponse } from "next/server";

const DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize";
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const SCOPE = "identify email guilds guilds.members.read";

export async function GET() {
  if (!CLIENT_ID || !REDIRECT_URI) {
    return NextResponse.json({ error: "Discord OAuth not configured" }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    prompt: "consent",
  });

  return NextResponse.redirect(`${DISCORD_AUTH_URL}?${params.toString()}`);
}
