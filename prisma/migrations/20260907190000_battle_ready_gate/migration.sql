ALTER TABLE "BattleMatchPlayer" ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "BattleMatchPlayer_matchId_readyAt_idx" ON "BattleMatchPlayer"("matchId","readyAt");

CREATE OR REPLACE FUNCTION enforce_battle_ready_gate() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status <> 'active' AND EXISTS (
    SELECT 1 FROM "BattleMatchPlayer" p WHERE p."matchId" = NEW.id AND p."readyAt" IS NULL
  ) THEN
    NEW.status := 'map_vote';
    NEW."startedAt" := NULL;
    NEW."responseDeadlineAt" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS battle_ready_gate ON "BattleMatch";
CREATE TRIGGER battle_ready_gate BEFORE UPDATE OF status ON "BattleMatch" FOR EACH ROW EXECUTE FUNCTION enforce_battle_ready_gate();
