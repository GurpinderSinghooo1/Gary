// Renders design/washi-bg-<season>.svg to app/src/main/assets/web/washi-bg-<season>.jpg (1920x1080),
// and copies spring to washi-bg.jpg (the fallback the page loads first).
// Run: for s in spring summer autumn winter; do python3 tools/make_washi_bg.py $s; done; node tools/render_washi_bg.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const web = path.join(root, 'app/src/main/assets/web');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    const svg = path.join(root, `design/washi-bg-${season}.svg`);
    if (!fs.existsSync(svg)) continue;
    await p.goto('file://' + svg);
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(web, `washi-bg-${season}.jpg`), type: 'jpeg', quality: 86 });
    console.log('rendered', season);
  }
  fs.copyFileSync(path.join(web, 'washi-bg-spring.jpg'), path.join(web, 'washi-bg.jpg'));
  await b.close();
})();
