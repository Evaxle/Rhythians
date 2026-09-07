ALTER TABLE "RhythiaModeScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPointOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RbpSeason" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RbpUserSeason" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RbpMatchResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RbpMatchAward" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "RhythiaModeScore" FROM anon, authenticated;
REVOKE ALL ON TABLE "UserPointOverride" FROM anon, authenticated;
REVOKE ALL ON TABLE "RbpSeason" FROM anon, authenticated;
REVOKE ALL ON TABLE "RbpUserSeason" FROM anon, authenticated;
REVOKE ALL ON TABLE "RbpMatchResult" FROM anon, authenticated;
REVOKE ALL ON TABLE "RbpMatchAward" FROM anon, authenticated;
