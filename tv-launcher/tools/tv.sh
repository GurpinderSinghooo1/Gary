#!/usr/bin/env bash
# Shared helpers: pick the TV and run adb against it.
# Usage: TV_IP=192.168.1.50 ./install.sh   (or have exactly one device already connected)
set -euo pipefail
command -v adb >/dev/null || { echo "adb not found. Install Android platform-tools first (see SETUP.md)."; exit 1; }
if [[ -n "${TV_IP:-}" ]]; then
  adb connect "${TV_IP}:${TV_PORT:-5555}" >/dev/null || true
  ADB=(adb -s "${TV_IP}:${TV_PORT:-5555}")
else
  ADB=(adb)
fi
tv() { "${ADB[@]}" "$@"; }
tvsh() { "${ADB[@]}" shell "$@"; }
PKG=com.gary.tvhome
