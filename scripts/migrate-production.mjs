import { Client } from "pg";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) throw new Error("DATABASE_URL is required");

let databaseUrl = rawDatabaseUrl;
if (process.env.VERCEL === "1") {
  const url = new URL(rawDatabaseUrl);
  const directHost = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(url.hostname);
  if (directHost) {
    url.hostname = "aws-0-us-east-1.pooler.supabase.com";
    if (url.username === "postgres") url.username = `postgres.${directHost[1]}`;
    url.port = "5432";
    databaseUrl = url.toString();
  }
}

const prismaEnv = { ...process.env, DATABASE_URL: databaseUrl };
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const battleMigration = "20260904000000_add_battle_reconnect_voting";
const tournamentStreamingMigration = "20260907003500_add_tournament_streaming_and_guards";
const migrationLock = "rhythians:prisma:migrations";

const client = new Client({ connectionString: databaseUrl });
await client.connect();

let lockHeld = false;

try {
  await client.query("SELECT pg_advisory_lock(hashtext($1))", [migrationLock]);
  lockHeld = true;

  const { rows } = await client.query("select to_regclass('public._prisma_migrations') as table_name");
  if (!rows[0]?.table_name) {
    const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const migration of migrations) {
      execFileSync(npx, ["prisma", "migrate", "resolve", "--applied", migration], {
        stdio: "inherit",
        env: prismaEnv,
      });
    }
  } else {
    const { rows: failedMigrations } = await client.query(
      'SELECT DISTINCT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY migration_name'
    );

    for (const { migration_name } of failedMigrations) {
      if (migration_name === battleMigration) {
        const { rows: schemaRows } = await client.query(`
          SELECT
            to_regclass('public."RbpSeason"') IS NOT NULL AS has_rbp_season,
            to_regclass('public."RbpMatchAward"') IS NOT NULL AS has_rbp_match_award,
            to_regclass('public."BattleMatchMapOption"') IS NOT NULL AS has_map_options,
            to_regclass('public."BattleMatchMapVote"') IS NOT NULL AS has_map_votes,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='BattleMatch' AND column_name='responseDeadlineAt') AS has_response_deadline,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='BattleMatchPlayer' AND column_name='scoreSubmittedAt') AS has_score_submitted,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='BattleMatchPlayer' AND column_name='lastSeenAt') AS has_last_seen,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='BattleMatchPlayer' AND column_name='disconnectedAt') AS has_disconnected,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='BattleMatchPlayer' AND column_name='reconnectUntilAt') AS has_reconnect_until
        `);
        const complete = Object.values(schemaRows[0]).every(Boolean);
        if (complete) {
          console.warn(`Resolving completed Prisma migration as applied: ${migration_name}`);
          execFileSync(npx, ["prisma", "migrate", "resolve", "--applied", migration_name], { stdio: "inherit", env: prismaEnv });
        } else {
          console.warn(`Resolving incomplete Prisma migration for re-application: ${migration_name}`);
          execFileSync(npx, ["prisma", "migrate", "resolve", "--rolled-back", migration_name], { stdio: "inherit", env: prismaEnv });
        }
        continue;
      }

      if (migration_name === tournamentStreamingMigration) {
        const { rows: schemaRows } = await client.query(`
          SELECT
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='TournamentSignup' AND column_name='streamOptIn') AS has_stream_opt_in,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='TournamentSignup' AND column_name='streamPlatform') AS has_stream_platform,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='TournamentSignup' AND column_name='streamIdentity') AS has_stream_identity,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='TournamentMatch' AND column_name='team1Score') AS has_team1_score,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='TournamentMatch' AND column_name='team2Score') AS has_team2_score,
            EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='Tournament_single_active_idx') AS has_single_active_index,
            EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='TournamentSignup_stream_opt_in_idx') AS has_stream_index
        `);
        const complete = Object.values(schemaRows[0]).every(Boolean);
        if (complete) {
          console.warn(`Resolving completed Prisma migration as applied: ${migration_name}`);
          execFileSync(npx, ["prisma", "migrate", "resolve", "--applied", migration_name], { stdio: "inherit", env: prismaEnv });
        } else {
          console.warn(`Resolving incomplete Prisma migration for re-application: ${migration_name}`);
          execFileSync(npx, ["prisma", "migrate", "resolve", "--rolled-back", migration_name], { stdio: "inherit", env: prismaEnv });
        }
        continue;
      }

      throw new Error(`Unresolved Prisma migration: ${migration_name}`);
    }
  }

  execFileSync(npx, ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: prismaEnv,
  });

  const { rows: finalState } = await client.query(`
    SELECT COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS failed_count
    FROM "_prisma_migrations"
  `);

  if (Number(finalState[0].failed_count) !== 0) {
    throw new Error(`Prisma migration verification failed: ${finalState[0].failed_count} migration(s) remain unresolved`);
  }

  const { rows: requiredObjects } = await client.query(`
    SELECT
      to_regclass('public."RbpSeason"') IS NOT NULL AS has_rbp_season,
      to_regclass('public."RbpMatchAward"') IS NOT NULL AS has_rbp_match_award,
      to_regclass('public."BattleMatchMapOption"') IS NOT NULL AS has_map_options,
      to_regclass('public."BattleMatchMapVote"') IS NOT NULL AS has_map_votes,
      to_regclass('public."Tournament"') IS NOT NULL AS has_tournament,
      to_regclass('public."TournamentSignup"') IS NOT NULL AS has_tournament_signup,
      to_regclass('public."TournamentMapPool"') IS NOT NULL AS has_tournament_map_pool,
      to_regclass('public."TournamentTeam"') IS NOT NULL AS has_tournament_team,
      to_regclass('public."TournamentTeamMember"') IS NOT NULL AS has_tournament_team_member,
      to_regclass('public."TournamentMatch"') IS NOT NULL AS has_tournament_match,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='BattleMatch' AND column_name='responseDeadlineAt') AS has_response_deadline,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='BattleMatchPlayer' AND column_name='scoreSubmittedAt') AS has_score_submitted,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='BattleMatchPlayer' AND column_name='lastSeenAt') AS has_last_seen,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='BattleMatchPlayer' AND column_name='disconnectedAt') AS has_disconnected,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='BattleMatchPlayer' AND column_name='reconnectUntilAt') AS has_reconnect_until,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='TournamentSignup' AND column_name='streamOptIn') AS has_tournament_stream_opt_in,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='TournamentMatch' AND column_name='team1Score') AS has_tournament_team1_score,
      EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='BattleMatch_responseDeadlineAt_idx') AS has_response_index,
      EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='BattleMatchPlayer_reconnectUntilAt_idx') AS has_reconnect_index,
      EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='Tournament_status_scheduledAt_idx') AS has_tournament_status_index,
      EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='TournamentSignup_tournament_split_status_idx') AS has_tournament_signup_index,
      EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='TournamentMatch_tournament_status_idx') AS has_tournament_match_index,
      EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='Tournament_single_active_idx') AS has_single_active_index
  `);

  if (!Object.values(requiredObjects[0]).every(Boolean)) {
    throw new Error("Prisma migration verification failed: battle/RBP/tournament schema objects are incomplete");
  }
} finally {
  if (lockHeld) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [migrationLock]);
  await client.end();
}
