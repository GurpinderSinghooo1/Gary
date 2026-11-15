#!/usr/bin/env bash
# One-time SmartThings sign-in so TV Home can wake the soundbar over Wi-Fi, forever.
# (SmartThings personal tokens now expire after 24 h; OAuth refresh tokens keep renewing.)
#
# Before running:
#   1. npm install -g @smartthings/cli
#   2. smartthings apps:create   ->  choose "OAuth-In App"
#        name: TV Home, redirect URI: https://httpbin.org/get
#        scopes: r:devices:*  x:devices:*  r:scenes:*  x:scenes:*
#      It prints an OAuth Client Id and Client Secret. Keep them.
#   3. ./smartthings-oauth.sh
set -euo pipefail
cd "$(dirname "$0")"
read -rp "OAuth Client Id: " CID
read -rsp "OAuth Client Secret: " CSECRET; echo
REDIRECT="${REDIRECT:-https://httpbin.org/get}"
SCOPE="r:devices:* x:devices:* r:scenes:* x:scenes:*"
ENC_SCOPE=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$SCOPE")
ENC_RED=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=""))' "$REDIRECT")
echo
echo "Open this link in a browser, sign in to Samsung, pick your location and allow access:"
echo "  https://api.smartthings.com/oauth/authorize?client_id=$CID&response_type=code&redirect_uri=$ENC_RED&scope=$ENC_SCOPE"
echo
echo "The browser lands on a page whose address contains code=XXXXXX. Paste that code here."
read -rp "code: " CODE
RES=""
for URL in https://api.smartthings.com/oauth/token https://api.smartthings.com/v1/oauth/token; do
  RES=$(curl -s -u "$CID:$CSECRET" -X POST "$URL" \
    -d grant_type=authorization_code -d client_id="$CID" -d code="$CODE" --data-urlencode redirect_uri="$REDIRECT") || true
  grep -q refresh_token <<<"$RES" && break
done
grep -q refresh_token <<<"$RES" || { echo "Token exchange failed: $RES"; exit 1; }
RT=$(python3 -c 'import json,sys;print(json.loads(sys.argv[1])["refresh_token"])' "$RES")
AT=$(python3 -c 'import json,sys;print(json.loads(sys.argv[1])["access_token"])' "$RES")
echo
echo "Your SmartThings devices:"
curl -s -H "Authorization: Bearer $AT" https://api.smartthings.com/v1/devices | python3 -c '
import json,sys
for d in json.load(sys.stdin).get("items",[]): print("  ", d["deviceId"], "|", d.get("label") or d.get("name"))'
read -rp "Device id of the soundbar: " DEV
python3 _cfg.py settings smartthingsClientId="$CID" smartthingsClientSecret="$CSECRET" smartthingsRefreshToken="$RT" smartthingsDeviceId="$DEV"
echo "Now run: TV_IP=<tv ip> ./push-config.sh   (do it within a day or two; the refresh token is single-use)"
