#!/usr/bin/env bash
# Makes TV Home the TV's REAL home screen, so HOME never flashes Google's screen first.
#
# Why this is needed: on Google TV the HOME button does not go to "the default home app". It goes to
# Google's Setup Wizard, which passes it on to Google's home screen. Switching off only Google's home
# screen leaves the wizard with nowhere to go, and it loops. Switching off BOTH lets Android use the
# normal default-home setting, which is TV Home.
#
# What it does, in order, and it checks itself:
#   1. Confirms TV Home is installed and opens.
#   2. Sets TV Home as the default home app.
#   3. Switches off the Setup Wizard and Google's home screen (pm disable-user: nothing is deleted).
#   4. Presses HOME twice and checks that TV Home is what comes up.
#   5. If the check fails, it switches everything back on by itself and says so.
#
# Usage:
#   TV_IP=192.168.2.19 ./make-default.sh            do it (asks first; undoes itself if the check fails)
#   TV_IP=192.168.2.19 ./make-default.sh --status   show how HOME is set up right now, change nothing
#   TV_IP=192.168.2.19 ./make-default.sh --undo     switch Google's home screen and wizard back on
set -euo pipefail
cd "$(dirname "$0")"; source ./tv.sh

HOME_ACT="$PKG/.HomeActivity"
WIZARD="com.google.android.tungsten.setupwraith"
STOCK="com.google.android.apps.tv.launcherx com.google.android.tvlauncher com.google.android.leanbacklauncher"

installed() { tvsh pm list packages "$1" | tr -d '\r' | grep -qx "package:$1"; }
enabled()   { tvsh pm list packages -e "$1" | tr -d '\r' | grep -qx "package:$1"; }
focus()     { tvsh dumpsys window | tr -d '\r' | grep -E 'mCurrentFocus|mFocusedApp' | head -2 || true; }
tvhome_in_front() { focus | grep -q "$PKG/"; }
default_home() { tvsh cmd package resolve-activity --brief -c android.intent.category.HOME -a android.intent.action.MAIN | tr -d '\r' | tail -1; }

status() {
  echo "Default home app : $(default_home)"
  for p in $WIZARD $STOCK; do
    installed "$p" || continue
    if enabled "$p"; then echo "  on   $p"; else echo "  off  $p"; fi
  done
  echo "HOME-button backup service: $(./home-button.sh status)"
}

switch_back_on() {
  for p in $WIZARD $STOCK; do
    installed "$p" && tvsh pm enable "$p" >/dev/null 2>&1 || true
  done
  ./home-button.sh on >/dev/null 2>&1 || true
}

case "${1:-apply}" in
  --status) status; exit 0 ;;
  --undo)
    switch_back_on
    echo "Google's home screen and Setup Wizard are back on. HOME still opens TV Home through the backup service."
    echo "To go fully back to Google TV: ./home-button.sh off, then Settings > Apps > Default apps > Home app."
    exit 0 ;;
  apply|--yes) ;;
  *) echo "usage: $0 [--status|--undo]"; exit 1 ;;
esac

echo "== 1. Checking TV Home"
installed "$PKG" || { echo "TV Home is not installed. Run ./install.sh first."; exit 1; }
tvsh am start -W -n "$HOME_ACT" >/dev/null 2>&1 || true
sleep ${TV_WAIT:-2}
tvhome_in_front || { echo "TV Home did not open. Nothing was changed."; focus; exit 1; }
echo "   TV Home opens: ok"

echo "== 2. Setting TV Home as the default home app"
tvsh cmd package set-home-activity "$HOME_ACT" 2>&1 | tr -d '\r' | sed 's/^/   /' || true

echo "== 3. Switching off the Setup Wizard and Google's home screen (nothing is deleted)"
if [[ "${2:-}" != "--yes" && "${1:-}" != "--yes" ]]; then
  echo "   This switches off Google's Setup Wizard as well as Google's home screen. With the wizard left on,"
  echo "   its recovery screen grabs HOME and loops (seen on this Hisense). Both come back with --undo,"
  echo "   and a factory reset restores them too."
  read -r -p "   Go ahead? (y/n) " answer
  [[ "$answer" == "y" ]] || { echo "Nothing was changed."; exit 0; }
fi
# From here on, any failure or Ctrl-C puts everything back.
trap 'echo; echo "Interrupted: switching everything back on."; switch_back_on' ERR INT TERM
# The wizard goes first. If the TV refuses, stop here: Google's screen must not go off while the wizard is on.
if installed "$WIZARD"; then
  tvsh pm disable-user --user 0 "$WIZARD" >/dev/null 2>&1 || true
  if enabled "$WIZARD"; then
    trap - ERR INT TERM
    echo "   The TV refused to switch off the Setup Wizard, so Google's home screen was left alone."
    echo "   Nothing was changed. HOME keeps working through the backup service."
    exit 1
  fi
  echo "   off  $WIZARD"
fi
./home-button.sh off >/dev/null     # so the test below measures the real thing, not the backup
for p in $STOCK; do
  installed "$p" || continue
  tvsh pm disable-user --user 0 "$p" >/dev/null 2>&1 || true
  if enabled "$p"; then echo "   could not switch off $p"; else echo "   off  $p"; fi
done
tvsh cmd package set-home-activity "$HOME_ACT" >/dev/null 2>&1 || true

echo "== 4. Testing the HOME button (the TV will flick to Settings and back, twice)"
pass=1
for n in 1 2; do
  tvsh am start -a android.settings.SETTINGS >/dev/null 2>&1 || true
  sleep ${TV_WAIT:-2}
  tvsh input keyevent KEYCODE_HOME
  sleep ${TV_WAIT:-2}
  if tvhome_in_front; then echo "   press $n: TV Home came up"
  else echo "   press $n: TV Home did NOT come up"; focus | sed 's/^/      /'; pass=0; break; fi   # stop at once: undo comes next
done
trap - ERR INT TERM

if [[ $pass == 1 ]]; then
  ./home-button.sh on >/dev/null   # kept as a backup, and it lets the bedtime timer put the TV to sleep
  echo
  echo "Done. TV Home is now the real home screen: HOME goes straight to it, with no Google screen first."
  echo "It stays that way after a restart. A big TV software update can switch Google's screen back on;"
  echo "if the flash ever returns, run this script again."
  echo "To undo: ./make-default.sh --undo"
else
  echo
  switch_back_on
  echo "The check failed, so everything has been switched back on. The TV is as it was before."
  tvsh am start -n "$HOME_ACT" >/dev/null 2>&1 || true
  echo "Send Claude the lines above (they show what the TV opened instead)."
  exit 1
fi
