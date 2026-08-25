CREATE OR REPLACE FUNCTION cleanup_ranked_map_scores_on_rank_change()
RETURNS TRIGGER AS $$
BEGIN
  IF FLOOR(COALESCE(OLD."rhp", 0) / 500) <> FLOOR(COALESCE(NEW."rhp", 0) / 500) THEN
    DELETE FROM "RankedMapScore"
    WHERE "userId" = NEW."id"
      AND "rankIndex" <> FLOOR(COALESCE(NEW."rhp", 0) / 500)::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "User_ranked_map_score_cleanup" ON "User";
CREATE TRIGGER "User_ranked_map_score_cleanup"
AFTER UPDATE OF "rhp" ON "User"
FOR EACH ROW
EXECUTE FUNCTION cleanup_ranked_map_scores_on_rank_change();
