// Renders design/washi-bg.svg to app/src/main/assets/web/washi-bg.jpg (1920x1080).
// node tools/render_washi_bg.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.join(root, 'design/washi-bg.svg'));
  await p.waitForTimeout(500);
  const out = path.join(root, 'app/src/main/assets/web/washi-bg.jpg');
  await p.screenshot({ path: out, type: 'jpeg', quality: 86 });
  await b.close();
  console.log('wrote', out);
})();
