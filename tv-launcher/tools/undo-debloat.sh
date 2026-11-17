#!/usr/bin/env bash
# Undoes what was switched off or removed on the Hisense TV (192.168.2.19) on 2026-11-14.
# Usage: TV_IP=192.168.2.19 ./undo-debloat.sh
cd "$(dirname "$0")"; source ./tv.sh

# 1. Removed for user 0 (pm uninstall -k --user 0): bring them back first.
tvsh cmd package install-existing com.vidaa.oemtabcontentprovider
tvsh cmd package install-existing net.vidaatv.hisense.android.tv
tvsh cmd package install-existing com.vt.hishow
tvsh cmd package install-existing com.vt.storemode
tvsh cmd package install-existing com.vt.tv.mobiledeviceconnectiontips

# 2. Disabled (pm disable-user): switch back on, including the five above.
tvsh pm enable com.google.android.apps.tv.dreamx
tvsh pm enable com.google.android.play.games
tvsh pm enable com.google.android.videos
tvsh pm enable com.android.dreams.basic
tvsh pm enable com.vidaa.oemtabcontentprovider
tvsh pm enable net.vidaatv.hisense.android.tv
tvsh pm enable com.vt.hishow
tvsh pm enable com.vt.storemode
tvsh pm enable com.vt.tv.mobiledeviceconnectiontips
tvsh pm enable android.autoinstalls.config.google.gtvpai

# 3. Google's home screen and Setup Wizard (switched off by make-default.sh).
tvsh pm enable com.google.android.tungsten.setupwraith
tvsh pm enable com.google.android.apps.tv.launcherx

# 4. Ad-blocking DNS back to the TV's normal setting.
tvsh settings put global private_dns_mode opportunistic
tvsh settings delete global private_dns_specifier

echo "Done. Screensaver and HOME button: ./home-button.sh off, or Settings > Device Preferences > Screen saver."
