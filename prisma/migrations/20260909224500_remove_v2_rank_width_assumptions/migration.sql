DROP TRIGGER IF EXISTS "User_ranked_map_score_cleanup" ON "User";
DROP FUNCTION IF EXISTS cleanup_ranked_map_scores_on_rank_change();

CREATE OR REPLACE FUNCTION public.place_rbp_users_for_season(p_season_id text, p_replace boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE affected integer;
BEGIN
  INSERT INTO "RbpUserSeason" ("id","seasonId","userId","placementRankIndex","rbp","createdAt","updatedAt")
  SELECT gen_random_uuid(),p_season_id,u.id,
    GREATEST(0,
      CASE
        WHEN GREATEST(0,u.rhp) >= 20750 THEN 7
        WHEN GREATEST(0,u.rhp) >= 15550 THEN 6
        WHEN GREATEST(0,u.rhp) >= 11300 THEN 5
        WHEN GREATEST(0,u.rhp) >= 7850 THEN 4
        WHEN GREATEST(0,u.rhp) >= 5150 THEN 3
        WHEN GREATEST(0,u.rhp) >= 3100 THEN 2
        WHEN GREATEST(0,u.rhp) >= 1600 THEN 1
        ELSE 0
      END
    ),
    GREATEST(0,
      CASE
        WHEN GREATEST(0,u.rhp) >= 20750 THEN 7
        WHEN GREATEST(0,u.rhp) >= 15550 THEN 6
        WHEN GREATEST(0,u.rhp) >= 11300 THEN 5
        WHEN GREATEST(0,u.rhp) >= 7850 THEN 4
        WHEN GREATEST(0,u.rhp) >= 5150 THEN 3
        WHEN GREATEST(0,u.rhp) >= 3100 THEN 2
        WHEN GREATEST(0,u.rhp) >= 1600 THEN 1
        ELSE 0
      END
    ) * 500,
    CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
  FROM "User" u WHERE u."profileHandle" <> 'rhythia-imports'
  ON CONFLICT ("seasonId","userId") DO UPDATE SET
    "placementRankIndex"=EXCLUDED."placementRankIndex","rbp"=EXCLUDED."rbp","updatedAt"=CURRENT_TIMESTAMP
  WHERE p_replace;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.place_rbp_users_for_season(text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.place_rbp_users_for_season(text,boolean) FROM anon;
REVOKE ALL ON FUNCTION public.place_rbp_users_for_season(text,boolean) FROM authenticated;
