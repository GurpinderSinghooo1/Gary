#!/usr/bin/env bash
# Makes HOME on the remote open TV Home (needed on Google TV builds, e.g. Hisense, that ignore
# the default-home setting). Turns on TV Home's HOME-button accessibility service.
# Usage: TV_IP=192.168.2.19 ./home-button.sh [on|off|status]
set -euo pipefail
cd "$(dirname "$0")"; source ./tv.sh
SVC="$PKG/$PKG.access.HomeButtonService"
cur=$(tvsh settings get secure enabled_accessibility_services | tr -d '\r')
[[ "$cur" == "null" ]] && cur=""
# Drop our entry (either spelling) from the colon-separated list, keep everyone else's.
others=$(tr ':' '\n' <<<"$cur" | grep -v -e "^$SVC\$" -e "^$PKG/.access.HomeButtonService\$" | grep -v '^$' | paste -sd: - || true)

case "${1:-on}" in
  on)
    new="${others:+$others:}$SVC"
    tvsh settings put secure enabled_accessibility_services "$new"
    tvsh settings put secure accessibility_enabled 1
    echo "HOME button → TV Home: on. Press HOME on the remote to test." ;;
  off)
    if [[ -n "$others" ]]; then tvsh settings put secure enabled_accessibility_services "$others"
    else tvsh settings delete secure enabled_accessibility_services >/dev/null; tvsh settings put secure accessibility_enabled 0; fi
    echo "HOME button → TV Home: off. HOME opens Google TV again." ;;
  status)
    if tr ':' '\n' <<<"$cur" | grep -q "HomeButtonService"; then echo "on"; else echo "off"; fi ;;
  *) echo "usage: $0 [on|off|status]"; exit 1 ;;
esac
