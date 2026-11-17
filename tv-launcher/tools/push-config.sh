#!/usr/bin/env bash
# Sends config.json (settings + your own content) to TV Home over adb. Re-run any time you edit it.
# Usage: TV_IP=192.168.1.50 ./push-config.sh [config.json]
set -euo pipefail
cd "$(dirname "$0")"; source ./tv.sh
CFG="${1:-config.json}"
[[ -f "$CFG" ]] || { echo "No $CFG. Copy config.example.json to config.json and fill it in."; exit 1; }
python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$CFG" || { echo "$CFG is not valid JSON"; exit 1; }
B64=$(python3 -c 'import base64,json,sys; print(base64.b64encode(json.dumps(json.load(open(sys.argv[1]))).encode()).decode())' "$CFG")
tvsh am broadcast -a com.gary.tvhome.SETUP -n $PKG/.setup.SetupReceiver --es b64 "$B64" | tr -d '\r' | tail -1
echo "Sent. The home screen reloads with the new settings."
