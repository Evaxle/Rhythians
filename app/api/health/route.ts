import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$connect();
    const users = await prisma.user.count();
    const clips = await prisma.clip.count();
    return NextResponse.json({ ok: true, database: "connected", users, clips });
  } catch (error) {
    console.error("Database health check failed", error);
    const message = error instanceof Error ? error.message : "Unknown database error";
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
    const category = code === "P1001" || /connect|reach|timeout|ECONN|ENOTFOUND|socket/i.test(message)
      ? "connection"
      : code === "P2021" || code === "P2022" || /table|column|relation|does not exist/i.test(message)
        ? "schema_or_query"
        : "database_query";
    return NextResponse.json(
      { ok: false, database: "unavailable", category, code, detail: message.slice(0, 240) },
      { status: 503 }
    );
  }
}