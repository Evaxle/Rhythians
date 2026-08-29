import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canReviewMaps } from "@/lib/map-review";
import { getPendingChallengeMaps } from "@/lib/maps";
import { getMapSubmissionMetadataMap } from "@/lib/map-submission-metadata";

export const dynamic = "force-dynamic";

function serializeMaps(maps: Awaited<ReturnType<typeof getPendingChallengeMaps>>) {
  return maps.map((map) => ({
    id: map.id,
    title: map.title,
    artist: map.artist,
    description: map.description,
    mapFileUrl: map.mapFileUrl,
    imageUrl: map.imageUrl,
    sourceUrl: map.sourceUrl,
    requestedRating: map.requestedRating,
    mapperName: map.mapperName,
    noteCount: map.noteCount,
    length: map.length,
    createdAt: map.createdAt.toISOString(),
    submittedBy: {
      username: map.submittedBy.username,
      displayName: map.submittedBy.displayName,
      profileHandle: map.submittedBy.profileHandle,
      avatar: map.submittedBy.avatar,
    },
  }));
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await canReviewMaps(user))) return NextResponse.json({ error: "You are not a map reviewer." }, { status: 403 });

  const url = new URL(request.url);
  const afterCreatedAt = url.searchParams.get("afterCreatedAt");
  const afterId = url.searchParams.get("afterId");
  let after: { createdAt: Date; id: string } | null = null;
  if (afterCreatedAt && afterId) {
    const createdAt = new Date(afterCreatedAt);
    if (Number.isNaN(createdAt.getTime())) return NextResponse.json({ error: "Invalid pagination cursor." }, { status: 400 });
    after = { createdAt, id: afterId };
  }

  const maps = await getPendingChallengeMaps({ take: 6, after });
  const hasMore = maps.length > 5;
  const visibleMaps = maps.slice(0, 5);
  const metadata = await getMapSubmissionMetadataMap(visibleMaps.map((map) => map.id));
  const data = serializeMaps(visibleMaps).map((map) => {
    const meta = metadata.get(map.id);
    return {
      ...map,
      submissionType: meta?.submissionType ?? "ranked",
      challengePlacement: meta?.challengePlacement ?? null,
      challengeLevel: meta?.challengeLevel ?? null,
    };
  });

  const last = visibleMaps.at(-1);
  return NextResponse.json({
    maps: data,
    hasMore,
    nextCursor: hasMore && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null,
  });
}
