Headless checks for the TV page (needs Node + Playwright with Chromium).

- `node tests/preview-all-themes.js`: loads all 15 themes in browser-preview mode, presses arrows/OK, opens the menu.
- `node tests/native-bridge.js`: injects a fake `TvBridge` that answers exactly like the Kotlin side and checks
  live data binding, continue-watching mapping and the launch commands OK sends.

Run `python3 tools/build_web.py` first.
