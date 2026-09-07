import { prisma } from "@/lib/db";
import {
  getTournamentPreflight,
  TOURNAMENT_CAPS,
  TOURNAMENT_MODES,
  TOURNAMENT_SPLIT_RANKS,
  tournamentCapState,
  tournamentTeamSize,
} from "@/lib/tournaments";

type TestStatus = "pass" | "warn" | "fail";
export type TournamentSelfTestCheck = { name: string; status: TestStatus; detail: string };

function add(checks: TournamentSelfTestCheck[], name: string, status: TestStatus, detail: string) {
  checks.push({ name, status, detail });
}

export async function runTournamentSelfTest(tournamentId?: string | null) {
  const startedAt = Date.now();
  const checks: TournamentSelfTestCheck[] = [];

  for (const mode of TOURNAMENT_MODES) {
    const teamSize = tournamentTeamSize(mode);
    const caps = TOURNAMENT_CAPS[mode];
    const valid = teamSize >= 1 && caps.every((cap) => cap % teamSize === 0 && (cap / teamSize & cap / teamSize - 1) === 0);
    add(checks, `${mode} bracket configuration`, valid ? "pass" : "fail", valid ? `${caps.join(" / ")} players produce power-of-two team brackets.` : "A player cap does not produce a valid power-of-two bracket.");
    const minimum = tournamentCapState(mode, caps[0]);
    add(checks, `${mode} cap logic`, minimum.canStart && minimum.secured === caps[0] ? "pass" : "fail", `Minimum secured cap resolves to ${minimum.secured}.`);
  }

  const splitShape = TOURNAMENT_SPLIT_RANKS.lower.includes("Diamond") && TOURNAMENT_SPLIT_RANKS.higher.includes("Emerald") && !TOURNAMENT_SPLIT_RANKS.higher.includes("Diamond");
  add(checks, "Tournament split definitions", splitShape ? "pass" : "fail", `Lower: ${TOURNAMENT_SPLIT_RANKS.lower.join(", ")} · Higher: ${TOURNAMENT_SPLIT_RANKS.higher.join(", ")}`);

  try {
    const schema = (await prisma.$queryRawUnsafe<Array<Record<string, boolean>>>(`
      SELECT
        to_regclass('public."Tournament"') IS NOT NULL AS tournament,
        to_regclass('public."TournamentSignup"') IS NOT NULL AS signup,
        to_regclass('public."TournamentMapPool"') IS NOT NULL AS map_pool,
        to_regclass('public."TournamentTeam"') IS NOT NULL AS team,
        to_regclass('public."TournamentTeamMember"') IS NOT NULL AS team_member,
        to_regclass('public."TournamentMatch"') IS NOT NULL AS tournament_match,
        to_regclass('public."BattleMatch"') IS NOT NULL AS battle_match,
        to_regclass('public."BattleMatchPlayer"') IS NOT NULL AS battle_player
    `))[0];
    const missing = Object.entries(schema ?? {}).filter(([, value]) => !value).map(([key]) => key);
    add(checks, "Tournament database tables", missing.length ? "fail" : "pass", missing.length ? `Missing: ${missing.join(", ")}` : "All tournament and BattleMatch tables are present.");

    const columns = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(`
      SELECT table_name,column_name FROM information_schema.columns
      WHERE table_schema='public' AND (
        (table_name='TournamentSignup' AND column_name IN ('streamOptIn','streamPlatform','streamIdentity','signedUpAt','requestedSplit','splitRequestStatus')) OR
        (table_name='TournamentMatch' AND column_name IN ('team1Score','team2Score','battleMatchId','countdownEndsAt','matchDeadlineAt')) OR
        (table_name='BattleMatchPlayer' AND column_name IN ('accuracy','scoreSubmittedAt','scoreId'))
      )
    `);
    const expected = 14;
    add(checks, "Tournament score and signup columns", columns.length === expected ? "pass" : "fail", `${columns.length}/${expected} required columns detected.`);

    const activeCount = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "Tournament" WHERE status='active'`))[0]?.count ?? 0);
    add(checks, "Single active tournament guard", activeCount <= 1 ? "pass" : "fail", activeCount === 0 ? "No tournament is active." : `${activeCount} tournament${activeCount === 1 ? " is" : "s are"} active.`);

    const invalidMaps = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count
      FROM "TournamentMapPool" p JOIN "ChallengeMap" m ON m.id=p."mapId"
      WHERE NOT (m.status::text='approved' AND m.rating IS NOT NULL AND m."reviewerNote" IS DISTINCT FROM 'rhythia-unranked')
    `))[0]?.count ?? 0);
    add(checks, "Ranked map pool integrity", invalidMaps === 0 ? "pass" : "fail", invalidMaps === 0 ? "Every tournament pool entry is a ranked approved map." : `${invalidMaps} invalid map-pool entr${invalidMaps === 1 ? "y" : "ies"} found.`);

    const duplicateSignups = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count FROM (
        SELECT "tournamentId","userId" FROM "TournamentSignup" GROUP BY "tournamentId","userId" HAVING COUNT(*)>1
      ) d
    `))[0]?.count ?? 0);
    add(checks, "Signup uniqueness", duplicateSignups === 0 ? "pass" : "fail", duplicateSignups === 0 ? "No duplicate tournament signups found." : `${duplicateSignups} duplicate signup groups found.`);

    const invalidStreamForms = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count FROM "TournamentSignup"
      WHERE ("streamOptIn"=FALSE AND ("streamPlatform" IS NOT NULL OR "streamIdentity" IS NOT NULL))
         OR ("streamOptIn"=TRUE AND ("streamPlatform" IS NULL OR "streamIdentity" IS NULL))
         OR ("streamPlatform"='nightly' AND "streamIdentity"<>'discord')
    `))[0]?.count ?? 0);
    add(checks, "Livestream form integrity", invalidStreamForms === 0 ? "pass" : "fail", invalidStreamForms === 0 ? "Livestream opt-in answers are internally consistent." : `${invalidStreamForms} invalid livestream signup rows found.`);

    const duplicateBracketPlayers = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count FROM (
        SELECT "tournamentId","userId" FROM "TournamentTeamMember" GROUP BY "tournamentId","userId" HAVING COUNT(*)>1
      ) d
    `))[0]?.count ?? 0);
    add(checks, "Bracket player uniqueness", duplicateBracketPlayers === 0 ? "pass" : "fail", duplicateBracketPlayers === 0 ? "No player appears on multiple teams in the same tournament." : `${duplicateBracketPlayers} duplicate bracket-player groups found.`);

    const activeMatchIssues = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count
      FROM "TournamentMatch" tm
      LEFT JOIN "BattleMatch" bm ON bm.id=tm."battleMatchId"
      WHERE tm.status='active' AND (tm."battleMatchId" IS NULL OR bm.id IS NULL OR bm.status<>'active' OR tm."mapId" IS NULL)
    `))[0]?.count ?? 0);
    add(checks, "Active match linkage", activeMatchIssues === 0 ? "pass" : "fail", activeMatchIssues === 0 ? "Every active tournament match is linked to an active BattleMatch and map." : `${activeMatchIssues} active tournament match linkage issue${activeMatchIssues === 1 ? "" : "s"} found.`);

    if (tournamentId) {
      const exists = Number((await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "Tournament" WHERE id=$1`, tournamentId))[0]?.count ?? 0);
      if (!exists) {
        add(checks, "Selected tournament", "fail", "The selected tournament no longer exists.");
      } else {
        const preflight = await getTournamentPreflight(tournamentId);
        add(checks, "Selected tournament preflight", preflight.ready ? "pass" : "warn", preflight.ready ? "The selected tournament is ready to start." : `${preflight.errors.length} blocking item${preflight.errors.length === 1 ? "" : "s"}; ${preflight.warnings.length} warning${preflight.warnings.length === 1 ? "" : "s"}.`);
      }
    } else {
      add(checks, "Selected tournament preflight", "warn", "No tournament was selected, so event-specific preflight checks were skipped.");
    }
  } catch (error) {
    add(checks, "Database connectivity", "fail", error instanceof Error ? error.message : "Tournament database checks failed.");
  }

  const durationMs = Date.now() - startedAt;
  if (!checks.some((check) => check.name === "Database connectivity" && check.status === "fail")) {
    add(checks, "Database round trip", durationMs < 1500 ? "pass" : "warn", `Self-test completed in ${durationMs} ms.`);
  }

  const failed = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn").length;
  const passed = checks.filter((check) => check.status === "pass").length;
  return {
    ok: failed === 0,
    ranAt: new Date().toISOString(),
    durationMs,
    summary: { passed, warnings, failed, total: checks.length },
    checks,
  };
}
