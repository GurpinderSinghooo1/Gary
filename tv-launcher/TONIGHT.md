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
3. **Settings → Network & Internet → your Wi-Fi** → write down the **IP address** (looks like 192.168.1.50).

## On the laptop

1. Double-click **Setup TV.bat**. Type the TV's IP address.
2. The TV asks **"Allow USB debugging?"** → tick **Always allow** → **OK**.
3. Choose **5 (Show TV info)** first and send Claude the text or the saved `tv-info-….txt` file. It shows the
   TV model and, usually, the soundbar's name.
4. Choose **1 (Install TV Home)**. Press **HOME** on the remote. If asked, pick **TV Home → Always**.
5. Choose **2 (Remove ads and junk)** → it lists what it will switch off → **y**.
6. Choose **4 (Soundbar HDMI-CEC)**, then test: TV off, wait 10 seconds, TV on.

That's it. The Japanese screen shows up, and the screensaver becomes the lake scene.

## On the remote afterwards

- **Arrows / OK**: move and open. OK on a show card resumes that exact episode.
- **Menu** (or Settings button): change theme, soundbar on/off and volume, bedtime timer.
- **Back**: closes the menu.

## If anything looks wrong

- Run **Setup TV.bat → 8** to go back to the original Google home screen. Nothing is deleted.
- Run **Setup TV.bat → 7** to switch the removed apps back on.

## Later, with Claude (optional)

- **Soundbar over Wi-Fi** (if HDMI-CEC isn't reliable): a one-time Samsung sign-in, about 10 minutes.
- **Your season**: winter scenery shows from Nov 7. To keep cherry blossoms all year, set
  `"washi.season": "spring"` in config.json and use option 6.
