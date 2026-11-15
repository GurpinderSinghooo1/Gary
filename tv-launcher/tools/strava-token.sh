#!/usr/bin/env bash
# One-time Strava sign-in for the Pace, Callus and Engine themes (runs, splits, training minutes).
# Before running: create an API app at https://www.strava.com/settings/api
#   Authorization Callback Domain: localhost
set -euo pipefail
cd "$(dirname "$0")"
read -rp "Strava Client ID: " CID
read -rsp "Strava Client Secret: " CSECRET; echo
echo
echo "Open this link, click Authorize:"
echo "  https://www.strava.com/oauth/authorize?client_id=$CID&response_type=code&redirect_uri=http://localhost/exchange_token&approval_prompt=force&scope=read,activity:read_all"
echo "The browser then fails to load a localhost page. That's expected: copy the code=XXXX part of its address."
read -rp "code: " CODE
RES=$(curl -s -X POST https://www.strava.com/oauth/token -d client_id="$CID" -d client_secret="$CSECRET" -d code="$CODE" -d grant_type=authorization_code)
grep -q refresh_token <<<"$RES" || { echo "Failed: $RES"; exit 1; }
RT=$(python3 -c 'import json,sys;print(json.loads(sys.argv[1])["refresh_token"])' "$RES")
python3 _cfg.py settings stravaClientId="$CID" stravaClientSecret="$CSECRET" stravaRefreshToken="$RT"
echo "Now run: TV_IP=<tv ip> ./push-config.sh"
