# Setting up the TV

About 20 minutes the first time. You need a computer on the same Wi-Fi as the TV.

## 1. Turn on developer mode on the TV

1. Settings → System → About → scroll to **Android TV OS build** (or **Build**) → press OK **7 times**.
2. Settings → System → **Developer options** → turn on **USB debugging**. If there's a
   **Network debugging** / **ADB over network** option, turn that on too.
3. Settings → Network → your Wi-Fi → note the **IP address** (for example 192.168.1.50).

## 2. Install adb on the computer

- Windows: download "SDK Platform-Tools for Windows" from developer.android.com/tools/releases/platform-tools, unzip.
- Mac: `brew install android-platform-tools`

```bash
adb connect 192.168.1.50:5555
```

The TV shows **Allow USB debugging?** → tick **Always allow** → OK. Run `adb devices` and you should see the TV.

On Android TV 11+ without "Network debugging", use **Wireless debugging** → **Pair device with pairing code**
and run `adb pair <ip>:<port>` first.

## 3. Install TV Home

Get `tv-home-debug.apk` (from the GitHub Actions run, or `./gradlew assembleDebug`), then:

```bash
cd tv-launcher/tools
TV_IP=192.168.1.50 ./install.sh path/to/tv-home-debug.apk
```

This installs the app, grants "TV listings" (continue watching) and usage access (watch-time stats),
sets TV Home as the home screen, and lists which of your streaming apps it found. Press **HOME**. If the TV
asks which home app to use, choose **TV Home → Always**.

## 4. Remove the ads and junk (reversible)

```bash
TV_IP=192.168.1.50 ./debloat.sh            # shows what it would switch off
TV_IP=192.168.1.50 ./debloat.sh --apply    # does it, writes undo-debloat.sh
```

Only after TV Home has worked for a day or two, and only if Google's home screen still pops up:

```bash
TV_IP=192.168.1.50 ./debloat.sh --apply --stock-launcher
```

For vendor junk specific to your TV brand: `./debloat.sh --list`, send me the file, and I'll add the right packages.

## 5. Soundbar turns on with the TV

**Free route first: HDMI-CEC**

```bash
TV_IP=192.168.1.50 ./soundbar-cec.sh           # report
TV_IP=192.168.1.50 ./soundbar-cec.sh --apply   # switch CEC + system audio on
```

Then on the soundbar: cable in the **HDMI ARC/eARC** ports on both ends, input **D.IN / TV ARC**, **Anynet+ on**.
Test: TV off, wait 10 seconds, TV on with the TV remote.

**Sure route: SmartThings over Wi-Fi** (works even when CEC is flaky)

1. Add the soundbar to the SmartThings phone app (Samsung account) if it isn't already.
2. On the computer: `npm install -g @smartthings/cli`, then `smartthings apps:create`:
   - type **OAuth-In App**, name **TV Home**, redirect URI `https://httpbin.org/get`
   - scopes `r:devices:*  x:devices:*  r:scenes:*  x:scenes:*`
   - it prints a **Client Id** and **Client Secret**
3. `./smartthings-oauth.sh`: paste the id and secret, open the link, allow access, paste the code, and pick
   the soundbar from the list. The script saves everything to `tools/config.json`.
4. `TV_IP=192.168.1.50 ./push-config.sh`

From then on, every time the TV screen turns on, TV Home checks the soundbar and powers it on if it's off,
retrying for about 45 seconds while Wi-Fi reconnects. The Menu gets working soundbar buttons too:
on/off, volume, night mode. (SmartThings personal tokens now expire after 24 hours, which is why this uses
OAuth. The refresh token renews itself as long as the TV is used at least every few weeks.)

## 6. Optional extras

| For | Get | Then |
|---|---|---|
| Pace, Callus, Engine (runs, splits, training minutes) | Strava API app at strava.com/settings/api, callback domain `localhost` | `./strava-token.sh` |
| Date Night real movie picks | Free TMDB account → Settings → API → API key (v3) | put it in `config.json` as `tmdbKey` |
| Your own goals, wins, race, anniversary | edit the `store` section of `config.json` | `./push-config.sh` |

`config.json` holds keys. It is git-ignored; keep it off GitHub.

## 7. Switching themes

Remote **Menu** → Theme → ◀ ▶ → **Apply**. Or set `"theme"` in config.json and push it.

## If something goes wrong

- **Black screen / stuck**: `adb shell am force-stop com.gary.tvhome`, then `./home-button.sh on` (a force-stop
  switches the HOME-button service off), then press HOME.
- **Get the old home screen back**: Settings → Apps → Default apps → Home app. Or `./undo-debloat.sh`.
- **Uninstall completely**: `adb uninstall com.gary.tvhome`.
- **Continue watching is empty**: some apps don't publish to Android TV's "Watch Next" (Netflix does, YouTube
  partly). Check with `adb shell pm grant com.gary.tvhome android.permission.READ_TV_LISTINGS`.
