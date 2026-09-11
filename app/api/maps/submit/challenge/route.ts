import { NextResponse } from "next/server";
import { POST as submitMap } from "@/app/api/maps/submit/route";
import { prisma } from "@/lib/db";
import { setMapSubmissionMetadata } from "@/lib/map-submission-metadata";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });

  const requestedLevel = Number(body.requestedLevel);
  const requestedCategory = typeof body.challengeCategory === "string" ? body.challengeCategory : "";
  const forwardedCategory = requestedCategory === "vibro" ? "off_grid" : requestedCategory;
  const forwardedRequest = new Request(request.url.replace(/\/challenge$/, ""), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...body, submissionType: "challenge", challengeCategory: forwardedCategory }),
  });

  const response = await submitMap(forwardedRequest);
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !data) return NextResponse.json(data ?? { error: "Challenge map submission failed." }, { status: response.status });

  if (requestedCategory === "vibro" && typeof data.mapId === "string") {
    await prisma.categoryMap.update({ where: { id: data.mapId }, data: { category: "vibro" as never } });
    await setMapSubmissionMetadata(data.mapId, "challenge", "vibro", requestedLevel);
    return NextResponse.json({ ...data, challengeCategory: "vibro", requestedLevel });
  }

  return NextResponse.json(data, { status: response.status });
}
