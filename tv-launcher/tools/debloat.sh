#!/usr/bin/env bash
# Turns off ad, recommendation and preinstalled-junk packages. DRY RUN unless you pass --apply.
#  - Uses "pm disable-user", which only switches apps off. Nothing is deleted.
#  - Writes undo-debloat.sh next to this script so you can switch everything back on.
#  - Never touches the packages in KEEP (the TV breaks without them).
# Usage:
#   TV_IP=192.168.1.50 ./debloat.sh                 # show what would be disabled
#   TV_IP=192.168.1.50 ./debloat.sh --apply         # do it (safe list)
#   TV_IP=192.168.1.50 ./debloat.sh --apply --stock-launcher   # also switch off the Google TV home screen
#   TV_IP=192.168.1.50 ./debloat.sh --list          # dump every package so we can review vendor junk together
set -euo pipefail
cd "$(dirname "$0")"; source ./tv.sh

APPLY=0; STOCK=0; LIST=0
for a in "$@"; do case "$a" in --apply) APPLY=1;; --stock-launcher) STOCK=1;; --list) LIST=1;; esac; done

if [[ $LIST == 1 ]]; then tvsh pm list packages -f | tr -d '\r' | sed 's/^package://' | sort > packages-$(date +%Y%m%d).txt; echo "Saved packages-$(date +%Y%m%d).txt"; exit 0; fi

# Never disable these: setup, input, HDMI/CEC, the TV content provider, Play services, keyboard, voice.
KEEP="com.android.providers.tv com.google.android.gms com.google.android.gsf com.android.vending com.google.android.tvlauncher.setup
com.google.android.tv.remote.service com.android.tv.settings com.google.android.katniss com.google.android.inputmethod.latin
com.google.android.leanbackime com.android.systemui com.google.android.tungsten.setupwraith com.droidlogic.tvinput"

# Safe: ads, sponsored rows, recommendation feeds, ambient-mode ads, unused Google extras.
SAFE="com.google.android.tvrecommendations
com.google.android.leanbacklauncher.recommendations
com.google.android.apps.tv.dreamx
com.google.android.backdrop
com.google.android.play.games
com.google.android.videos
com.google.android.apps.mediashell.ads
com.android.dreams.basic"
# Optional: the stock home screen. Only with --stock-launcher, and only after TV Home works.
STOCK_PKGS="com.google.android.apps.tv.launcherx com.google.android.leanbacklauncher com.google.android.tvlauncher"
# Common vendor extras (TCL, Hisense, Sony, Philips, Xiaomi). Only disabled if present.
VENDOR="com.tcl.tvweishi com.tcl.esticker com.tcl.gallery com.tcl.ui_mediaCenter com.tcl.partnercustomizer com.tcl.guard
com.hisense.tv.vidaa.ads com.jamdeo.tv.vod com.sony.dtv.promos com.sony.dtv.sonyselect com.sony.dtv.recommendation
com.mitv.tvhome.atv com.xiaomi.mitv.upgrade com.netflix.partner.activation"

installed=$(tvsh pm list packages | tr -d '\r' | sed 's/^package://')
targets=()
for p in $SAFE $VENDOR; do grep -qx "$p" <<<"$installed" && targets+=("$p"); done
if [[ $STOCK == 1 ]]; then
  if ! tvsh cmd package resolve-activity -c android.intent.category.HOME -a android.intent.action.MAIN | grep -q "$PKG"; then
    echo "TV Home is not the default home yet. Run install.sh first and press HOME once."; exit 1
  fi
  for p in $STOCK_PKGS; do grep -qx "$p" <<<"$installed" && targets+=("$p"); done
fi
for p in "${targets[@]}"; do for k in $KEEP; do [[ "$p" == "$k" ]] && { echo "refusing to touch $p"; exit 1; }; done; done

if [[ ${#targets[@]} -eq 0 ]]; then echo "Nothing on the list is installed. Run with --list and send me the file."; exit 0; fi
echo "Will disable (${#targets[@]}):"; printf '   %s\n' "${targets[@]}"
if [[ $APPLY == 0 ]]; then echo; echo "Dry run. Re-run with --apply to do it."; exit 0; fi

UNDO=undo-debloat.sh
{ echo '#!/usr/bin/env bash'; echo 'cd "$(dirname "$0")"; source ./tv.sh'; } > $UNDO
for p in "${targets[@]}"; do
  if tvsh pm disable-user --user 0 "$p" | tr -d '\r' | grep -q "disabled"; then
    echo "   off  $p"; echo "tvsh pm enable $p" >> $UNDO
  else
    echo "   skip $p (TV refused)"
  fi
done
chmod +x $UNDO
echo "Done. To undo: ./$UNDO   (or Settings > Apps > show system apps > Enable)"
