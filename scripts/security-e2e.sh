#!/usr/bin/env bash
set -u
BASE="http://localhost:3000"
COOKIE="rhythians_session"
PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (expected $2 got $3)"; fi
}

has() { # has <name> <haystack> <needle>
  if echo "$2" | grep -qi "$3"; then pass "$1"; else fail "$1 (missing: $3)"; fi
}

ip() { echo "test-$1-$(date +%s).invalid"; }

UUID_RE='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

# ---------- Fixtures ----------
OWNER_TOKEN=$(NODE_PATH=/workspaces/Rhythians/node_modules DOTENV_CONFIG_QUIET=true node /tmp/owner_session.js 2>/dev/null | tail -1)
if [ -z "$OWNER_TOKEN" ]; then echo "FATAL: could not create owner session"; exit 1; fi
echo "owner session created"

J1=/tmp/sj1.txt; J2=/tmp/sj2.txt
for j in $J1 $J2; do rm -f "$j"; done

echo "========== SECURITY HEADERS =========="
HEADERS=$(curl -s -D - -o /dev/null $BASE/)
has "X-Frame-Options: DENY" "$HEADERS" "x-frame-options: DENY"
has "X-Content-Type-Options: nosniff" "$HEADERS" "x-content-type-options: nosniff"
has "Referrer-Policy" "$HEADERS" "referrer-policy:"
has "Content-Security-Policy" "$HEADERS" "content-security-policy:"
has "Permissions-Policy" "$HEADERS" "permissions-policy:"
has "CSP blocks frames (frame-ancestors none)" "$HEADERS" "frame-ancestors 'none'"

echo "========== CSRF / ORIGIN PROTECTION =========="
ORIGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Origin: https://evil.example.com" -H "Content-Type: application/json" -d '{}' $BASE/api/auth/login)
check "cross-origin POST rejected" "403" "$ORIGIN_CODE"
SAME_ORIGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -d '{"identifier":"nobody","password":"nope"}' $BASE/api/auth/login)
check "same-origin POST allowed (401 not 403)" "401" "$SAME_ORIGIN_CODE"

echo "========== SETUP ENDPOINT =========="
SETUP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/setup?secret=rhythians_session")
check "setup endpoint locked without SETUP_SECRET (503)" "503" "$SETUP_CODE"

echo "========== RATE LIMITING =========="
RL_IP=$(ip rl)
RL_BLOCKED=0
for i in $(seq 1 14); do
  c=$(curl -s -o /dev/null -w "%{http_code}" -H "x-forwarded-for: $RL_IP" -X POST -H "Content-Type: application/json" -d '{"identifier":"x","password":"y"}' $BASE/api/auth/login)
  if [ "$c" = "429" ]; then RL_BLOCKED=$((RL_BLOCKED+1)); fi
done
if [ "$RL_BLOCKED" -ge 1 ]; then pass "login rate-limited (429 after abuse)"; else fail "login rate limit not enforced"; fi

echo "========== AUTH REGISTRATION =========="
REG=$(curl -s -c $J1 -H "x-forwarded-for: $(ip r1)" -X POST -H "Content-Type: application/json" -d '{"username":"sectest1","email":"sectest1@test.com","password":"password123"}' $BASE/api/auth/register)
has "register creates account + session" "$REG" '"onboardingCompleted":false'
DUP=$(curl -s -o /dev/null -w "%{http_code}" -H "x-forwarded-for: $(ip r1)" -X POST -H "Content-Type: application/json" -d '{"username":"sectest1","email":"sectest1@test.com","password":"password123"}' $BASE/api/auth/register)
check "duplicate email register 409" "409" "$DUP"
WEAK=$(curl -s -o /dev/null -w "%{http_code}" -H "x-forwarded-for: $(ip r1)" -X POST -H "Content-Type: application/json" -d '{"username":"weakpass","email":"weak@test.com","password":"short"}' $BASE/api/auth/register)
check "weak password rejected" "400" "$WEAK"

echo "========== AUTH LOGIN =========="
LG_OK=$(curl -s -o /dev/null -w "%{http_code}" -H "x-forwarded-for: $(ip r1)" -X POST -H "Content-Type: application/json" -d '{"identifier":"sectest1","password":"password123"}' $BASE/api/auth/login)
check "login valid password" "200" "$LG_OK"
LG_BAD=$(curl -s -o /dev/null -w "%{http_code}" -H "x-forwarded-for: $(ip r1)" -X POST -H "Content-Type: application/json" -d '{"identifier":"sectest1","password":"wrongpass1"}' $BASE/api/auth/login)
check "login wrong password 401" "401" "$LG_BAD"

echo "========== ONBOARDING =========="
ONB=$(curl -s -b $J1 -H "x-forwarded-for: $(ip r1)" -X POST -H "Content-Type: application/json" -d '{"optionIds":["1535406525227470978","1537317017806180381"]}' $BASE/api/onboarding)
has "onboarding applies selected tags" "$ONB" '"applied":2'
ONB_PAGE=$(curl -s -o /dev/null -w "%{http_code}" -b $J1 $BASE/onboarding)
check "onboarding redirects when completed" "307" "$ONB_PAGE"

echo "========== AVATAR UPLOAD =========="
AV_BAD=$(curl -s -o /dev/null -w "%{http_code}" -b $J1 -F "avatar=@/tmp/test.png;type=text/plain" $BASE/api/profile/avatar)
check "avatar rejects wrong content type" "400" "$AV_BAD"
AV_OK=$(curl -s -o /dev/null -w "%{http_code}" -b $J1 -F "avatar=@/tmp/test.png;type=image/png" $BASE/api/profile/avatar)
check "avatar upload ok" "200" "$AV_OK"

echo "========== CLIPS (camera mode + submit) =========="
CLIP_BAD=$(curl -s -o /dev/null -w "%{http_code}" -b $J1 -H "Content-Type: application/json" -d '{"title":"bad","storagePath":"clips/x.mp4","cameraMode":"drone"}' $BASE/api/clips/submit)
check "clip submit rejects invalid camera mode" "400" "$CLIP_BAD"
CLIP_ID=$(curl -s -b $J1 -H "Content-Type: application/json" -d '{"title":"Security Test Clip","description":"test","cameraMode":"lock","storagePath":"clips/sec-test.mp4"}' $BASE/api/clips/submit | python3 -c "import sys,json; print(json.load(sys.stdin)['clipId'])" 2>/dev/null)
if [ -n "$CLIP_ID" ]; then pass "clip submitted with camera mode"; else fail "clip submit failed"; fi

echo "========== REPORTS =========="
U2ID=$(NODE_PATH=/workspaces/Rhythians/node_modules DOTENV_CONFIG_QUIET=true node /tmp/getuid.js sectest2 2>/dev/null | tail -1)
if [ -z "$U2ID" ]; then
  curl -s -H "x-forwarded-for: $(ip r2)" -X POST -H "Content-Type: application/json" -d '{"username":"sectest2","email":"sectest2@test.com","password":"password123"}' $BASE/api/auth/register > /dev/null
  U2ID=$(NODE_PATH=/workspaces/Rhythians/node_modules DOTENV_CONFIG_QUIET=true node /tmp/getuid.js sectest2 2>/dev/null | tail -1)
fi
U1ID=$(NODE_PATH=/workspaces/Rhythians/node_modules DOTENV_CONFIG_QUIET=true node /tmp/getuid.js sectest1 2>/dev/null | tail -1)
SELF_RPT=$(curl -s -o /dev/null -w "%{http_code}" -b $J1 -H "Content-Type: application/json" -d "{\"targetType\":\"user\",\"targetId\":\"$U1ID\",\"reason\":\"Spam or advertising\"}" $BASE/api/reports)
check "self-report rejected" "400" "$SELF_RPT"
RPT=$(curl -s -b $J1 -H "x-forwarded-for: $(ip r1)" -H "Content-Type: application/json" -d "{\"targetType\":\"user\",\"targetId\":\"$U2ID\",\"reason\":\"Harassment or hate\",\"description\":\"test report\"}" $BASE/api/reports)
has "report created" "$RPT" '"status":"open"'
RPT_DUP=$(curl -s -o /dev/null -w "%{http_code}" -b $J1 -H "x-forwarded-for: $(ip r1)" -H "Content-Type: application/json" -d "{\"targetType\":\"user\",\"targetId\":\"$U2ID\",\"reason\":\"Spam or advertising\"}" $BASE/api/reports)
check "duplicate open report blocked" "409" "$RPT_DUP"

echo "========== NOTIFICATIONS (warn) =========="
RPTID=$(curl -s -H "Cookie: $COOKIE=$OWNER_TOKEN" $BASE/api/admin/reports | python3 -c "import sys,json; d=json.load(sys.stdin); print([r['id'] for r in d['reports'] if r['targetUser'] and r['targetUser']['id']=='$U2ID' and r['status']=='open'][0])" 2>/dev/null)
WARN=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $COOKIE=$OWNER_TOKEN" -X PATCH -H "Content-Type: application/json" -d '{"action":"warn","message":"please behave"}' $BASE/api/admin/reports/$RPTID)
check "warn action ok" "200" "$WARN"

echo "========== BAN / UNBAN =========="
RPT2=$(curl -s -b $J1 -H "x-forwarded-for: $(ip r1)" -H "Content-Type: application/json" -d "{\"targetType\":\"user\",\"targetId\":\"$U2ID\",\"reason\":\"Impersonation\"}" $BASE/api/reports | python3 -c "import sys,json; print(json.load(sys.stdin)['report']['id'])" 2>/dev/null)
BAN=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $COOKIE=$OWNER_TOKEN" -X PATCH -H "Content-Type: application/json" -d '{"action":"ban"}' $BASE/api/admin/reports/$RPT2)
check "ban action ok" "200" "$BAN"
LOGIN_BANNED=$(curl -s -o /dev/null -w "%{http_code}" -H "x-forwarded-for: $(ip r2)" -X POST -H "Content-Type: application/json" -d '{"identifier":"sectest2","password":"password123"}' $BASE/api/auth/login)
check "banned user login 403" "403" "$LOGIN_BANNED"
UNBAN=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $COOKIE=$OWNER_TOKEN" -X PATCH $BASE/api/admin/users/$U2ID/unban)
check "unban ok" "200" "$UNBAN"
LOGIN_UNBANNED=$(curl -s -o /dev/null -w "%{http_code}" -H "x-forwarded-for: $(ip r2)" -X POST -H "Content-Type: application/json" -d '{"identifier":"sectest2","password":"password123"}' $BASE/api/auth/login)
check "unbanned user login 200" "200" "$LOGIN_UNBANNED"

echo "========== ADMIN ACCESS CONTROL =========="
ANON_ADMIN=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/admin/reports)
check "admin reports anon 401" "401" "$ANON_ADMIN"
NONOWNER_ADMIN=$(curl -s -o /dev/null -w "%{http_code}" -b $J1 $BASE/api/admin/reports)
check "admin reports non-owner 403" "403" "$NONOWNER_ADMIN"
OWNER_ADMIN=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $COOKIE=$OWNER_TOKEN" $BASE/api/admin/reports)
check "admin reports owner 200" "200" "$OWNER_ADMIN"

echo "========== APPROVAL PANEL ACCESS =========="
APPROVAL_ANON=$(curl -s -o /dev/null -w "%{http_code}" $BASE/approval)
check "approval anon redirect 307" "307" "$APPROVAL_ANON"
APPROVAL_PLAIN=$(curl -s -o /dev/null -w "%{http_code}" -b $J1 $BASE/approval)
check "approval plain user redirect 307" "307" "$APPROVAL_PLAIN"
NODE_PATH=/workspaces/Rhythians/node_modules DOTENV_CONFIG_QUIET=true node /tmp/addtag.js $U1ID post-reviewer > /dev/null 2>&1
APPROVAL_REV=$(curl -s -o /dev/null -w "%{http_code}" -b $J1 $BASE/approval)
check "approval post-reviewer 200" "200" "$APPROVAL_REV"
APPROVAL_API=$(curl -s -o /dev/null -w "%{http_code}" -b $J1 -X PATCH -H "Content-Type: application/json" -d '{"status":"approved"}' $BASE/api/approval/clips/$CLIP_ID)
check "approval API approve ok" "200" "$APPROVAL_API"

echo "========== CLIP DISPLAY =========="
CLIPS_HTML=$(curl -s $BASE/clips)
has "clips page shows camera badge" "$CLIPS_HTML" "Lock"
has "approved clip appears on clips page" "$CLIPS_HTML" "Security Test Clip"

echo "========== NOTIFICATIONS LIST + READ =========="
NOTIF=$(curl -s -H "Cookie: $COOKIE=$OWNER_TOKEN" $BASE/api/notifications)
has "notifications list ok" "$NOTIF" "unreadCount"
READ=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $COOKIE=$OWNER_TOKEN" -X POST -H "Content-Type: application/json" -d '{}' $BASE/api/notifications/read)
check "mark all read ok" "200" "$READ"

echo "========== DISCORD INTERNAL SYNC AUTH =========="
SYNC_NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/internal/discord/sync)
check "internal sync unauth 401" "401" "$SYNC_NOAUTH"
SYNC_AUTH=$(curl -s -o /dev/null -w "%{http_code}" -H "x-vercel-cron: 1" $BASE/api/internal/discord/sync)
check "internal sync cron header 200" "200" "$SYNC_AUTH"

echo "========== DISCORD SYNC MAPPINGS =========="
MAPPINGS=$(curl -s -H "Cookie: $COOKIE=$OWNER_TOKEN" $BASE/api/admin/discord/roles | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(1 for r in d.get('roles',[]) if r.get('mappedTagId')))" 2>/dev/null)
if [ -n "$MAPPINGS" ] && [ "$MAPPINGS" -ge 9 ]; then pass "role->tag mappings present ($MAPPINGS)"; else fail "mappings count: $MAPPINGS"; fi

echo "========== LOGOUT =========="
curl -s -b $J1 -o /dev/null $BASE/api/auth/logout
LG_AFTER=$(curl -s -o /dev/null -w "%{http_code}" -b $J1 $BASE/api/notifications)
check "session destroyed after logout (401)" "401" "$LG_AFTER"

echo ""
echo "=============================="
echo "PASS: $PASS  FAIL: $FAIL"
echo "=============================="
[ "$FAIL" -eq 0 ]
