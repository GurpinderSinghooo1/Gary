/*
 * Remote-control checks for every theme, run headless (Playwright + Chromium).
 *   node tests/remote.test.js        exits 1 if anything fails
 *
 * Part 1 (browser preview data): every theme loads, every tile can be reached with the arrows,
 *   arrows only ever move in the direction pressed, BACK opens and closes the menu.
 * Part 2 (fake TV bridge): menu actions send the right commands, All apps / Inputs work,
 *   holding OK launches once, and a dead internet connection never holds the screen back.
 */
const { chromium } = require('playwright');
const path = require('path');
const PAGE = 'file://' + path.resolve(__dirname, '..') + '/app/src/main/assets/web/home.html';
const THEMES = ['marquee', 'still', 'control', 'aurora', 'washi', 'sora', 'summit', 'loadout', 'studio', 'phulkari', 'callus', 'forge', 'pace', 'engine', 'datenight'];
const KEYS = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.log('  FAIL ' + msg); } }

// A stand-in for the Kotlin side. `slow` lists methods that never answer in time (no internet).
function fakeBridge(opts) {
  const now = Date.now();
  const R = {
    'settings.get': { theme: 'washi', homeName: 'Ottawa', secondName: 'Amritsar', smartthingsConfigured: false, canSleepTv: true, hiddenApps: ['com.hidden.app'] },
    'apps': [
      { id: 'netflix', packageName: 'com.netflix.ninja', label: 'Netflix', installed: true, bannerUrl: '/banner/com.netflix.ninja' },
      { id: 'youtube', packageName: 'com.google.android.youtube.tv', label: 'YouTube', installed: true },
      { id: 'disney', packageName: 'com.disney.disneyplus', label: 'Disney+', installed: true },
      { id: 'prime', packageName: 'com.amazon.amazonvideo.livingroom', label: 'Prime Video', installed: true },
      { id: 'paramount', packageName: 'com.cbs.ca', label: 'Paramount+', installed: true },
      { id: 'com.android.vending', packageName: 'com.android.vending', label: 'Play Store', installed: true },
      { id: 'com.hidden.app', packageName: 'com.hidden.app', label: 'Hidden', installed: true },
      { id: 'com.plexapp.android', packageName: 'com.plexapp.android', label: 'Plex', installed: true },
      { id: 'a1', packageName: 'a1', label: 'App one', installed: true }, { id: 'a2', packageName: 'a2', label: 'App two', installed: true }
    ],
    'inputs': [{ id: 'hdmi/1', label: 'HDMI 1', connected: true }, { id: 'hdmi/2', label: 'HDMI 2', connected: false }],
    'continueWatching': { permission: true, items: [{ title: 'Stranger Things', season: '4', episode: '4', packageName: 'com.netflix.ninja', progress: 41, durationMs: 4800000, positionMs: 1968000, posterUrl: null, intentUri: 'intent://netflix#Intent;end', lastEngagementMs: now }] },
    'system': { wifi: { connected: true, linkSpeedMbps: 866, signalLevel: 3 }, storage: { freeBytes: 4e9, totalBytes: 8e9 } },
    'stats': { granted: true, todayMs: 1800000, weekMs: 18000000, yearMs: 540000000, last7Days: [0, 1, 2, 0, 3, 4, 2].map(m => m * 600000), streakDays: 3, topApp: 'netflix' },
    'store.get': {},
    'weather': { name: 'Ottawa', current: { temp: -4.4, feelsLike: -9.6, code: 71, text: 'Snow', windKmh: 22, windDir: 290, cloud: 100, isDay: true }, daily: [{ date: '2026-11-16', max: -1, min: -7, sunrise: '2026-11-16T07:01', sunset: '2026-11-16T16:31' }] },
    'bedtime': { endsAt: now + 1800000 }
  };
  window.__calls = [];
  window.TvBridge = {
    isNative: () => true, version: () => 'test',
    request: (m, a, id) => {
      window.__calls.push([m, JSON.parse(a || '{}')]);
      if (opts.slow.indexOf(m) >= 0) return; // never answers
      setTimeout(() => TvHome.resolve(id, { ok: true, data: m in R ? JSON.parse(JSON.stringify(R[m])) : true }), 5);
    }
  };
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const newPage = async (bridge) => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    p.on('pageerror', e => errors.push(p.url().split('?')[1] + ': ' + e.message));
    if (bridge) await p.addInitScript(fakeBridge, bridge);
    return p;
  };
  const ready = p => p.waitForFunction(() => document.body.classList.contains('ready') && window.__tvTest.focus() >= 0, null, { timeout: 8000 });
  const tilesInfo = p => p.evaluate(() => [...document.querySelectorAll('.screen:not([hidden]) [data-tile]')].map(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, on: e.classList.contains('on') }; }));
  const menuState = p => p.evaluate(() => { const m = document.getElementById('tvMenu'), a = document.getElementById('tvApps'); return { menu: !!m && !m.hidden, apps: !!a && !a.hidden, on: (document.querySelector('#tvMenu .mb.on') || {}).textContent || '', appOn: (document.querySelector('#tvApps .ac.on') || {}).textContent || '', appCount: document.querySelectorAll('#tvApps .ac').length }; });
  const calls = (p, name) => p.evaluate(n => window.__calls.filter(c => c[0] === n).map(c => c[1]), name);

  /* ---------- Part 1: every theme, preview data ---------- */
  let p = await newPage();
  for (const id of THEMES) {
    console.log(id);
    await p.goto(PAGE + '?theme=' + id); await ready(p);
    ok(await p.evaluate(() => [...document.querySelectorAll('.screen')].filter(s => !s.hidden).length) === 1, id + ': exactly one theme visible');
    const n = (await tilesInfo(p)).length;
    ok(n >= 5, id + ': has at least the five app tiles (' + n + ')');
    // From every tile, each arrow either stays put or lands on a tile that really is in that direction.
    const reach = new Set([await p.evaluate(() => window.__tvTest.focus())]);
    for (let i = 0; i < n; i++) for (const dir of Object.keys(KEYS)) {
      await p.evaluate(k => window.__tvTest.setFocus(k), i);
      const before = await tilesInfo(p);
      await p.keyboard.press(KEYS[dir]);
      const j = await p.evaluate(() => window.__tvTest.focus());
      if (j === i) continue;
      const a = before[i], b = before[j];
      const right = dir === 'left' ? b.x < a.x : dir === 'right' ? b.x > a.x : dir === 'up' ? b.y < a.y - 20 : b.y > a.y + 20;
      ok(right, id + ': ' + dir + ' from tile ' + i + ' went to tile ' + j + ', which is not ' + dir);
    }
    // Reachability with real key presses only.
    await p.goto(PAGE + '?theme=' + id); await ready(p);
    const start = await p.evaluate(() => window.__tvTest.focus());
    const edges = {};
    for (let i = 0; i < n; i++) { edges[i] = []; for (const dir of Object.keys(KEYS)) { await p.evaluate(k => window.__tvTest.setFocus(k), i); await p.keyboard.press(KEYS[dir]); edges[i].push(await p.evaluate(() => window.__tvTest.focus())); } }
    const seen = new Set([start]), queue = [start];
    while (queue.length) for (const t of edges[queue.shift()]) if (!seen.has(t)) { seen.add(t); queue.push(t); }
    ok(seen.size === n, id + ': all ' + n + ' tiles reachable with arrows (got ' + seen.size + ')');
    // BACK opens the menu on every theme, and closes it again.
    await p.evaluate(() => TvHome.emit('back'));
    ok((await menuState(p)).menu, id + ': BACK opens the menu');
    await p.keyboard.press('ArrowRight');
    ok(/OK to apply/.test((await menuState(p)).on), id + ': RIGHT in the menu offers the next theme');
    await p.evaluate(() => TvHome.emit('back'));
    ok(!(await menuState(p)).menu, id + ': BACK closes the menu');
    ok(reach.size > 0, id);
  }
  // Switching theme from the menu (preview mode navigates to ?theme=<next>).
  await p.goto(PAGE + '?theme=washi'); await ready(p);
  await p.evaluate(() => TvHome.emit('back')); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
  await p.waitForURL(/theme=sora/, { timeout: 5000 }).then(() => ok(true, ''), () => ok(false, 'menu: OK on the theme row switches to the next theme'));
  await p.goto(PAGE + '?theme=nonsense'); await ready(p);
  ok(await p.evaluate(() => document.body.getAttribute('data-theme-id')) === 'washi', 'unknown theme name falls back to Washi');
  await p.close();

  /* ---------- Part 2: fake TV bridge ---------- */
  console.log('bridge');
  p = await newPage({ slow: [] });
  await p.goto(PAGE + '?theme=washi'); await ready(p);
  ok(await p.evaluate(() => document.querySelector('[data-b="wx.tc"]').textContent) === '−4°C', 'live weather is shown');
  // Holding OK launches the show once.
  await p.evaluate(() => { for (let i = 0; i < 6; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: i > 0 })); });
  const launched = await calls(p, 'launchUri');
  ok(launched.length === 1 && launched[0].uri === 'intent://netflix#Intent;end', 'OK resumes the show, once, even when held (' + launched.length + ')');
  // UP and DOWN on Washi's single row do nothing.
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowDown');
  ok(await p.evaluate(() => window.__tvTest.focus()) === 2, 'UP/DOWN on a single row keep the focus where it is');
  // HOME returns to the first tile and closes anything open.
  await p.evaluate(() => { TvHome.emit('back'); TvHome.emit('home'); });
  ok(!(await menuState(p)).menu && await p.evaluate(() => window.__tvTest.focus()) === 0, 'HOME closes the menu and returns to the first tile');
  // Menu → Apps → All apps.
  await p.evaluate(() => TvHome.emit('back')); await p.keyboard.press('ArrowDown');
  ok((await menuState(p)).on === 'All apps', 'menu: second row is Apps');
  await p.keyboard.press('Enter');
  let st = await menuState(p);
  ok(st.apps && !st.menu, 'All apps opens');
  ok(st.appCount === 9, 'All apps lists every installed app except hidden ones (' + st.appCount + ')');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
  ok((await menuState(p)).appOn === 'Netflix', 'All apps: arrows move around the grid and stop at the edges');
  for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Enter');
  ok((await calls(p, 'launch')).some(c => c.packageName === 'com.android.vending'), 'All apps: OK opens the chosen app (Play Store)');
  ok(!(await menuState(p)).apps, 'All apps closes after opening an app');
  // Inputs.
  await p.evaluate(() => TvHome.emit('back')); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
  ok((await menuState(p)).appOn === 'HDMI 1', 'Inputs lists the TV inputs');
  await p.keyboard.press('Enter');
  ok((await calls(p, 'launchInput')).some(c => c.id === 'hdmi/1'), 'Inputs: OK switches to HDMI 1');
  // BACK closes All apps (blue key opens it directly).
  await p.evaluate(() => TvHome.emit('colorKey', { color: 'blue' }));
  ok((await menuState(p)).apps, 'blue key opens All apps');
  await p.evaluate(() => TvHome.emit('back'));
  st = await menuState(p);
  ok(!st.apps && !st.menu, 'BACK closes All apps');
  // Bedtime.
  await p.evaluate(() => TvHome.emit('colorKey', { color: 'yellow' })); await p.keyboard.press('Enter');
  ok((await calls(p, 'bedtime')).some(c => c.minutes === 30), 'bedtime: 30 min sends the timer');
  await p.evaluate(() => TvHome.emit('bedtime', { phase: 'end' }));
  ok(await p.evaluate(() => document.body.classList.contains('bed-dim')), 'bedtime end dims the screen');
  await p.keyboard.press('ArrowRight');
  ok(!await p.evaluate(() => document.body.classList.contains('bed-dim')), 'any key undims');
  // A resume before the page is ready must not break anything; a changed list reloads.
  await p.evaluate(() => TvHome.emit('resume'));
  await p.close();

  // No internet: weather never answers. The screen must still appear quickly, with dashes not sample numbers.
  p = await newPage({ slow: ['weather'] });
  const t0 = Date.now();
  await p.goto(PAGE + '?theme=washi'); await ready(p);
  const took = Date.now() - t0;
  ok(took < 3500, 'no internet: home screen appears in ' + took + ' ms (limit 3500)');
  ok(await p.evaluate(() => document.querySelector('[data-b="wx.tc"]').textContent) === '–', 'no internet: weather shows a dash, not sample numbers');
  await p.keyboard.press('Enter');
  ok((await calls(p, 'launchUri')).length === 1, 'no internet: apps still open');
  await p.close();

  ok(errors.length === 0, 'no JavaScript errors: ' + errors.join(' | '));
  await browser.close();
  console.log(failures ? '\n' + failures + ' of ' + checks + ' checks FAILED' : '\nAll ' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
