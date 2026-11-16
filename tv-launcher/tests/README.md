Headless checks for the TV page (needs Node + Playwright with Chromium). Run `python3 tools/build_web.py` first.

- `node tests/remote.test.js`: the real test. Exits 1 on any failure. All 15 themes: every tile reachable,
  arrows only move the way they point, BACK opens/closes the menu; then with a fake `TvBridge`: launch
  commands, All apps, Inputs, bedtime, held OK, and start-up with no internet. Runs in CI.
- `node tests/preview-all-themes.js` and `node tests/native-bridge.js`: older print-outs, handy for eyeballing
  what each theme shows with sample or bridge data.
