# Tonight: getting the Japanese home screen on the TV

About 15 minutes. You need the TV, the TV remote and a Windows laptop on the same Wi-Fi.

## Before you start (on the laptop)

1. Download the app file: open the latest build at
   https://github.com/GurpinderSinghooo1/Gary/actions/workflows/tv-launcher.yml
   → click the top run → **Artifacts** → **tv-home-debug-apk**. It downloads a zip; open it, and the
   `tv-home-debug.apk` file inside can stay in your Downloads folder.
2. Get the setup folder: from the same GitHub repo, branch `claude/quirky-mayer-iv5ej1`, folder
   `tv-launcher/tools/windows` (or from the zip Claude sent). You need `Setup TV.bat` and `Setup-TV.ps1`.

## On the TV (2 minutes, with the remote)

1. **Settings → System → About** → scroll to **Build** → press OK **7 times** ("You are now a developer").
2. **Settings → System → Developer options** → turn on **USB debugging**.
3. Your TV's IP address is **192.168.2.19** (already filled in by the setup tool). If the TV ever gets a new one:
   Settings → System → About → Status.

## On the laptop

1. Double-click **Setup TV.bat**. Press Enter to use 192.168.2.19.
2. The TV asks **"Allow USB debugging?"** → tick **Always allow** → **OK**.
3. Choose **5 (Show TV info)** first and send Claude the text or the saved `tv-info-….txt` file. It shows the
   TV model and, usually, the soundbar's name.
4. Choose **1 (Install TV Home)**. Press **HOME** on the remote. If asked, pick **TV Home → Always**.
5. Choose **2 (Remove ads and junk)** → it lists what it will switch off → **y**.
6. Choose **4 (Soundbar)** and follow the steps for your cable (see below).

That's it. The Japanese screen shows up, and the screensaver becomes the lake scene.

## Your soundbar (Samsung HW-J355)

It has no HDMI and no Wi-Fi, so it can't be controlled by the TV directly. It can wake itself:

- **Optical cable** (thin cable, glowing red tip): on the **soundbar remote**, press **SOURCE** until it shows
  **D.IN**, then press **AUTO POWER** (or hold **◀** on the round pad for 5 seconds) until it shows
  **ON-POWER LINK**. Now the soundbar turns on when the TV sends sound, and off a few minutes after the TV goes off.
  Volume stays on the soundbar remote (optical can't carry volume).
- **Bluetooth**: press **BT POWER** on the soundbar remote until it shows **ON-BLUETOOTH POWER**, and pair the
  soundbar in the TV's Bluetooth settings. The TV reconnects on wake, which turns the soundbar on, and the
  **TV remote controls the volume**. Small chance of slight lip-sync delay.

If you want one remote for everything, Bluetooth is the way. If you want the best sound with no delay, optical.

## On the remote afterwards

- **Arrows / OK**: move and open. OK on a show card resumes that exact episode.
- **Menu** (or Settings button): change theme, bedtime timer, refresh, Android settings.
- **Back**: closes the menu.

## If anything looks wrong

- Run **Setup TV.bat → 8** to go back to the original Google home screen. Nothing is deleted.
- Run **Setup TV.bat → 7** to switch the removed apps back on.

## Later, with Claude (optional)

- **Your season**: winter scenery shows from Nov 7. To keep cherry blossoms all year, set
  `"washi.season": "spring"` in config.json and use option 6.
