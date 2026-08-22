-- The previous path implementation could accept an older/top score.
-- Reset only the active season so every current path rank must be earned again
-- under the recent, normal-speed, after-previous-rank rules.
DELETE FROM "SeasonalPathCompletion"
WHERE "seasonId" IN (
  SELECT "id"
  FROM "SeasonalPathSeason"
  WHERE "startsAt" <= CURRENT_TIMESTAMP
    AND "endsAt" > CURRENT_TIMESTAMP
);
