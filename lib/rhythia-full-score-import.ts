import { prisma } from "@/lib/db";
import { fetchRhythiaProfile } from "@/lib/rhythia";
import { syncUserModeScores } from "@/lib/rhythia-mode-points";
import { placeLinkedUserInBattleRank } from "@/lib/rbp-placement";
import { fetchRhythiaAccountCreatedAt, syncAutomaticPlayerClassification } from "@/lib/player-classification";

export async function rebuildRhythiaScorePoints(userId: string) {
  const linked = await prisma.rhythiaProfile.findUnique({ where: { userId }, select: { profileId: true, profileUrl: true } });
  if (!linked) throw new Error("This player does not have a linked Rhythia profile.");

  const [profile, accountCreatedAt] = await Promise.all([
    fetchRhythiaProfile(linked.profileId),
    fetchRhythiaAccountCreatedAt(linked.profileId).catch(() => null),
  ]);
  const result = await syncUserModeScores(userId);
  const { bio: _bio, ...profileData } = profile;

  await prisma.$transaction(async (tx) => {
    await tx.rhythiaProfile.update({ where: { userId }, data: { ...profileData, profileUrl: linked.profileUrl, syncedAt: new Date() } });
    await syncAutomaticPlayerClassification(tx, userId, profile.globalRank, accountCreatedAt);
  });
  await placeLinkedUserInBattleRank(userId).catch(() => undefined);

  return {
    rpl: result.rpl,
    rps: result.rps,
    rpv: result.rpv,
    rhp: result.rhp,
    passedScores: result.rows.length,
    uniqueScoredMaps: new Set(result.rows.map((row) => row.mapKey)).size,
    modes: result.foundModes,
  };
}