CREATE OR REPLACE FUNCTION public.ranking_v2_battle_seed(p_rhp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN GREATEST(0,p_rhp) < 150 THEN 0
    WHEN p_rhp < 300 THEN 0
    WHEN p_rhp < 450 THEN 150
    WHEN p_rhp < 600 THEN 300
    WHEN p_rhp < 750 THEN 450
    WHEN p_rhp < 920 THEN 600
    WHEN p_rhp < 1090 THEN 750
    WHEN p_rhp < 1260 THEN 920
    WHEN p_rhp < 1430 THEN 1090
    WHEN p_rhp < 1600 THEN 1260
    WHEN p_rhp < 1820 THEN 1430
    WHEN p_rhp < 2040 THEN 1600
    WHEN p_rhp < 2260 THEN 1820
    WHEN p_rhp < 2480 THEN 2040
    WHEN p_rhp < 2700 THEN 2260
    WHEN p_rhp < 2960 THEN 2480
    WHEN p_rhp < 3220 THEN 2700
    WHEN p_rhp < 3480 THEN 2960
    WHEN p_rhp < 3740 THEN 3220
    WHEN p_rhp < 4000 THEN 3480
    WHEN p_rhp < 4300 THEN 3740
    WHEN p_rhp < 4600 THEN 4000
    WHEN p_rhp < 4900 THEN 4300
    WHEN p_rhp < 5200 THEN 4600
    WHEN p_rhp < 5500 THEN 4900
    WHEN p_rhp < 5840 THEN 5200
    WHEN p_rhp < 6180 THEN 5500
    WHEN p_rhp < 6520 THEN 5840
    WHEN p_rhp < 6860 THEN 6180
    WHEN p_rhp < 7200 THEN 6520
    WHEN p_rhp < 7560 THEN 6860
    WHEN p_rhp < 7920 THEN 7200
    WHEN p_rhp < 8280 THEN 7560
    WHEN p_rhp < 8640 THEN 7920
    WHEN p_rhp < 9000 THEN 8280
    WHEN p_rhp < 9400 THEN 8640
    WHEN p_rhp < 9800 THEN 9000
    WHEN p_rhp < 10200 THEN 9400
    WHEN p_rhp < 10600 THEN 9800
    WHEN p_rhp < 11000 THEN 10200
    ELSE 10600
  END;
$$;

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
    CASE
      WHEN public.ranking_v2_battle_seed(u.rhp) >= 11000 THEN 8
      WHEN public.ranking_v2_battle_seed(u.rhp) >= 9000 THEN 7
      WHEN public.ranking_v2_battle_seed(u.rhp) >= 7200 THEN 6
      WHEN public.ranking_v2_battle_seed(u.rhp) >= 5500 THEN 5
      WHEN public.ranking_v2_battle_seed(u.rhp) >= 4000 THEN 4
      WHEN public.ranking_v2_battle_seed(u.rhp) >= 2700 THEN 3
      WHEN public.ranking_v2_battle_seed(u.rhp) >= 1600 THEN 2
      WHEN public.ranking_v2_battle_seed(u.rhp) >= 750 THEN 1
      ELSE 0
    END,
    public.ranking_v2_battle_seed(u.rhp),
    CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
  FROM "User" u WHERE u."profileHandle" <> 'rhythia-imports'
  ON CONFLICT ("seasonId","userId") DO UPDATE SET
    "placementRankIndex"=EXCLUDED."placementRankIndex","rbp"=EXCLUDED."rbp","updatedAt"=CURRENT_TIMESTAMP
  WHERE p_replace;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.ranking_v2_battle_seed(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.place_rbp_users_for_season(text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.place_rbp_users_for_season(text,boolean) FROM anon;
REVOKE ALL ON FUNCTION public.place_rbp_users_for_season(text,boolean) FROM authenticated;
