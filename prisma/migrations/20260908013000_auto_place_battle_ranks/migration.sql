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
    GREATEST(0,LEAST(8,FLOOR(GREATEST(0,u.rhp)::numeric/500)::integer)-1),
    GREATEST(0,LEAST(8,FLOOR(GREATEST(0,u.rhp)::numeric/500)::integer)-1)*500,
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
CREATE OR REPLACE FUNCTION public.auto_place_rbp_users_for_new_season()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN PERFORM public.place_rbp_users_for_season(NEW.id,false); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS "RbpSeason_auto_place_users" ON "RbpSeason";
CREATE TRIGGER "RbpSeason_auto_place_users" AFTER INSERT ON "RbpSeason" FOR EACH ROW EXECUTE FUNCTION public.auto_place_rbp_users_for_new_season();
