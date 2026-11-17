#!/usr/bin/env bash
# Phase 2, free route: make the soundbar follow the TV over HDMI-CEC.
# Shows the TV's current CEC state, then (with --apply) switches on the settings that make
# "TV on" wake the soundbar and "TV off" put it to sleep.
# Setting names differ between Android versions, so we read the list the TV reports and only
# set the ones it actually has.
#   TV_IP=192.168.1.50 ./soundbar-cec.sh           # report only
#   TV_IP=192.168.1.50 ./soundbar-cec.sh --apply   # change settings
set -euo pipefail
cd "$(dirname "$0")"; source ./tv.sh

echo "== Android $(tvsh getprop ro.build.version.release | tr -d '\r'), device type: $(tvsh getprop ro.hdmi.device_type | tr -d '\r')"
echo "== Global settings"
for k in hdmi_control_enabled hdmi_control_auto_wakeup_enabled hdmi_control_auto_device_off_enabled hdmi_system_audio_control_enabled; do
  printf '   %-40s %s\n' "$k" "$(tvsh settings get global $k | tr -d '\r')"
done
echo "== CEC devices the TV can see"
tvsh dumpsys hdmi_control 2>/dev/null | tr -d '\r' | grep -Ei "deviceinfo|audio|system audio|arc|power" | head -40 || echo "   (dumpsys hdmi_control not available)"

HAS_CMD=0
if tvsh cmd hdmi_control help 2>/dev/null | grep -qi cec_setting; then HAS_CMD=1; fi
if [[ $HAS_CMD == 1 ]]; then
  echo "== CEC settings (cmd hdmi_control)"
  tvsh cmd hdmi_control cec_setting list 2>/dev/null | tr -d '\r' | sed 's/^/   /' || true
fi

[[ "${1:-}" == "--apply" ]] || { echo; echo "Report only. Re-run with --apply to switch CEC on."; exit 0; }

echo "== Applying"
tvsh settings put global hdmi_control_enabled 1
tvsh settings put global hdmi_control_auto_wakeup_enabled 1
tvsh settings put global hdmi_control_auto_device_off_enabled 1
tvsh settings put global hdmi_system_audio_control_enabled 1 || true
if [[ $HAS_CMD == 1 ]]; then
  have=$(tvsh cmd hdmi_control cec_setting list 2>/dev/null | tr -d '\r')
  setc() { grep -q "$1" <<<"$have" && tvsh cmd hdmi_control cec_setting set "$1" "$2" && echo "   $1 = $2" || true; }
  setc hdmi_cec_enabled 1
  setc power_control_mode to_tv_and_audio_system
  setc tv_send_standby_on_sleep 1
  setc tv_wake_on_one_touch_play 1
  setc system_audio_control 1
  tvsh cmd hdmi_control setsam on 2>/dev/null && echo "   system audio mode = on" || true
fi
cat <<'TXT'

Now on the soundbar itself (Samsung):
  1. HDMI cable in the TV port marked ARC or eARC, and in the soundbar's HDMI ARC/eARC port.
  2. Soundbar input: D.IN / TV ARC. Anynet+ ON (soundbar menu, or hold the remote's Up for 5 s on some models).
  3. Turn the TV off, wait 10 s, turn it on with the TV remote. The soundbar should wake within a few seconds.
If it still doesn't, the SmartThings route (SETUP.md) wakes it over Wi-Fi every time the TV screen comes on.
TXT
