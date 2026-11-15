#!/usr/bin/env bash
# Installs TV Home, grants the permissions it needs, and makes it the home screen.
# Usage: TV_IP=192.168.1.50 ./install.sh path/to/tv-home-debug.apk
set -euo pipefail
cd "$(dirname "$0")"; source ./tv.sh
APK="${1:-../app/build/outputs/apk/debug/app-debug.apk}"
[[ -f "$APK" ]] || { echo "APK not found: $APK"; exit 1; }

echo "== TV: $(tvsh getprop ro.product.manufacturer | tr -d '\r') $(tvsh getprop ro.product.model | tr -d '\r'), Android $(tvsh getprop ro.build.version.release | tr -d '\r')"
echo "== Installing $APK"
tv install -r "$APK"

echo "== Granting permissions"
tvsh pm grant $PKG android.permission.READ_TV_LISTINGS 2>/dev/null && echo "   continue watching: ok" || echo "   continue watching: grant failed (accept the prompt on the TV instead)"
tvsh appops set $PKG GET_USAGE_STATS allow && echo "   watch-time stats: ok"

echo "== Making TV Home the home screen"
if tvsh cmd package set-home-activity $PKG/.HomeActivity 2>/dev/null | grep -qi success; then
  echo "   set as default home: ok"
else
  echo "   Could not set it automatically. Press HOME on the remote and choose TV Home, Always."
fi

echo "== Checking which streaming apps are installed"
for p in com.netflix.ninja com.google.android.youtube.tv com.disney.disneyplus com.amazon.amazonvideo.livingroom com.amazon.avod.thirdpartyclient com.cbs.ott com.cbs.app com.paramount.plus; do
  if tvsh pm list packages "$p" | tr -d '\r' | grep -qx "package:$p"; then echo "   found  $p"; fi
done

echo "== Screensaver: Washi scene instead of Google's ambient mode"
tvsh settings put secure screensaver_components $PKG/.dream.TvHomeDream && tvsh settings put secure screensaver_enabled 1 && echo "   ok"

tvsh am start -n $PKG/.HomeActivity >/dev/null
echo "Done. Press HOME on the remote."
