# Updating the TV (Mac)

Ten minutes. You need the Mac and the TV on the same Wi-Fi. Each grey box is one line to paste into
**Terminal** (press Enter after each).

## 1. Get the new app file

Open https://github.com/GurpinderSinghooo1/Gary/actions/workflows/tv-launcher.yml → click the top run with a
green tick → **Artifacts** → **tv-home-debug-apk**. Safari unzips it into Downloads as `tv-home-debug.apk`.

## 2. Get the latest scripts

If the project folder is already on the Mac, open Terminal in it and run:

```bash
git pull
```

If not, download the branch as a zip from GitHub (green **Code** button → **Download ZIP**) and unzip it.
Then go to the tools folder (adjust the first part to where the folder is):

```bash
cd ~/Downloads/Gary-claude-quirky-mayer-iv5ej1/tv-launcher/tools
```

## 3. Install the update

```bash
TV_IP=192.168.2.19 ./install.sh ~/Downloads/tv-home-debug.apk
```

Your theme and settings stay as they are. If the TV shows **Allow USB debugging?**, tick **Always allow** → OK
and run the line again.

## 4. Make TV Home the real home screen (once)

```bash
TV_IP=192.168.2.19 ./make-default.sh
```

This is the fix for Google's screen flashing up when you press HOME. The TV flicks to Settings and back twice
while the script tests the HOME button. It ends with either:

- **"Done. TV Home is now the real home screen"**: finished. Press HOME from inside Netflix to see it.
- **"The check failed, so everything has been switched back on"**: nothing is broken and the TV is as it was.
  Copy what Terminal printed and send it to Claude.

## What changed on the remote

- **Back** opens the menu on every theme: Theme (◀ ▶ to flip through, OK to apply), **All apps**, Inputs,
  Bedtime, Android settings.
- **All apps** shows everything installed on the TV, not only the five streaming apps.
- **Bedtime** now puts the whole TV to sleep when the timer ends, whatever you are watching.
- Up and Down no longer make the highlight jump sideways.

## If anything looks wrong

| Problem | Fix |
|---|---|
| Want Google's home screen back | `TV_IP=192.168.2.19 ./make-default.sh --undo` then `TV_IP=192.168.2.19 ./home-button.sh off` |
| TV stuck on a black or "starting" screen after step 4 | Unplug the TV for 10 seconds, plug it back in, then run the `--undo` line above |
| Everything that was ever switched off, back on | `TV_IP=192.168.2.19 ./undo-debloat.sh` |
| See how HOME is set up right now | `TV_IP=192.168.2.19 ./make-default.sh --status` |
| Remove TV Home completely | run the `--undo` line first, then `adb uninstall com.gary.tvhome` |

Windows instead of a Mac: double-click `tools/windows/Setup TV.bat`; option 1 installs, option 3 is step 4.

## Your soundbar (Samsung HW-J355)

It has no HDMI and no Wi-Fi, so the TV cannot control it directly. It can wake itself:

- **Optical cable**: on the soundbar remote press **SOURCE** until it shows **D.IN**, then **AUTO POWER** until
  it shows **ON-POWER LINK**. The soundbar turns on when the TV sends sound. Volume stays on the soundbar remote.
- **Bluetooth**: press **BT POWER** until it shows **ON-BLUETOOTH POWER** and pair it in the TV's Bluetooth
  settings. The TV remote then controls the volume. Small chance of slight lip-sync delay.
