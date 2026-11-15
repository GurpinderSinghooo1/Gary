/*
 * app.js: runs the chosen theme on the TV.
 *
 *  1. Reads ?theme=<id> (set by the Android side from saved settings).
 *  2. Loads live data through TvHome (apps, continue watching, weather, soundbar, stats, Strava...).
 *  3. Builds the themes (window.__buildThemes, generated from the design file) with that data.
 *  4. Shows only the chosen theme and drives it with the remote:
 *       arrows = move focus (spatial), OK = open, Menu = quick menu, Back = close menu.
 *  5. Keeps clocks, weather and soundbar fresh, and reloads when you come back from an app
 *     and "continue watching" changed.
 */
(function () {
  'use strict';

  var THEMES = [
    ['marquee', 'Marquee'], ['still', 'Still'], ['control', 'Control Room'], ['aurora', 'Aurora'],
    ['washi', 'Washi'], ['sora', 'Sora'], ['summit', 'Summit'], ['loadout', 'Loadout'], ['studio', 'Studio'],
    ['phulkari', 'Phulkari'], ['callus', 'Callus'], ['forge', 'Forge'], ['pace', 'Pace'], ['engine', 'Engine'],
    ['datenight', 'Date Night']
  ];
  var themeId = new URLSearchParams(location.search).get('theme') || 'washi';
  var themeIndex = Math.max(0, THEMES.findIndex(function (t) { return t[0] === themeId; }));
  themeId = THEMES[themeIndex][0];

  var Q = new URLSearchParams(location.search);
  var DREAM = Q.get('mode') === 'dream';
  var D = window.__DATA = { native: TvHome.native && !DREAM, dream: DREAM };
  var T = null; // result of __buildThemes()

  /* ---------------- formatting helpers ---------------- */
  var MINUS = '−';
  function deg(v) { if (v === null || v === undefined || isNaN(v)) return '–'; var n = Math.round(v); return (n < 0 ? MINUS + Math.abs(n) : String(n)) + '°'; }
  function compass(d) { return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((d % 360) + 360) % 360 / 45) % 8]; }
  function hhmm(iso) { return iso && iso.length >= 16 ? iso.slice(11, 16) : '–'; }
  function minsLeft(item) {
    if (!item.durationMs || item.positionMs === undefined) return '';
    var m = Math.max(0, Math.round((item.durationMs - item.positionMs) / 60000));
    if (m >= 60) return Math.floor(m / 60) + ' h ' + (m % 60) + ' min left';
    return m + ' min left';
  }
  function metaFor(item) {
    var parts = [];
    if (item.season && item.episode) parts.push('S' + item.season + ' · E' + item.episode);
    else if (item.episodeTitle) parts.push(item.episodeTitle);
    var left = minsLeft(item);
    if (left) parts.push(left);
    if (!parts.length) parts.push('Continue watching');
    return parts.join(' · ');
  }
  function fmtRuntime(min) { if (!min) return ''; return Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0') + ' m'; }

  /* ---------------- data → theme model (called from inside __buildThemes) ---------------- */
  window.__applyData = function (APPS, EXTRA) {
    if (!D.native) return; // desktop preview keeps the sample shows
    var byId = {};
    (D.apps || []).forEach(function (a) { byId[a.id] = a; });
    var items = (D.cw && D.cw.items) || [];
    APPS.forEach(function (a) {
      var info = byId[a.id];
      a.pkg = info ? info.packageName : null;
      a.installed = info ? info.installed : false;
      var item = null;
      for (var i = 0; i < items.length; i++) if (items[i].packageName && items[i].packageName === a.pkg) { item = items[i]; break; }
      if (item) {
        a.show = item.title || a.name;
        a.meta = metaFor(item);
        a.prog = item.progress || 0;
        a.intentUri = item.intentUri || null;
        a.poster = item.posterUrl || null;
      } else {
        a.show = a.installed ? 'Open ' + a.name : a.name;
        a.meta = a.installed ? 'Nothing in progress' : 'Not installed · OK to get it';
        a.prog = 0;
        a.intentUri = null;
        a.poster = null;
      }
    });
  };

  var PICK_COLORS = [['#3b1e54', '#d46a8c', '#ffcf9e'], ['#0f4c6b', '#f2b880', '#fff0c9'], ['#2b0f12', '#b8452f', '#ff8a5c']];
  window.__applyPicks = function (PICKS) {
    var picks = D.picks;
    if (!picks || !picks.length) return;
    PICKS.length = 0;
    picks.slice(0, 3).forEach(function (p, i) {
      var col = PICK_COLORS[i % 3];
      var why = (p.overview || '').split('. ')[0];
      if (why && why.length > 150) why = why.slice(0, 147) + '…';
      PICKS.push({
        t: p.title, g: (p.genres && p.genres[0]) || '', r: fmtRuntime(p.runtimeMin) || p.year, app: (p.provider || '').replace('Amazon ', '').replace(' Plus', '+'),
        min: p.runtimeMin || 110, c: [col[0], col[1]], sun: col[2], why: why ? why + '.' : '', poster: p.posterUrl, appId: p.appId
      });
    });
  };

  /* ---------------- live text bindings: <span data-b="key"> ---------------- */
  function binds() {
    var m = {};
    var w = D.weather && D.weather.current;
    if (w) {
      var today = (D.weather.daily && D.weather.daily[0]) || {};
      m['wx.t'] = deg(w.temp);
      m['wx.tc'] = deg(w.temp) + 'C';
      m['wx.tcU'] = m['wx.tc'];
      m['wx.text'] = w.text || '';
      var c = w.code;
      m['wx.kanji'] = c <= 1 ? '晴' : c <= 3 ? '曇' : c <= 48 ? '霧' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? '雪' : c >= 95 ? '雷' : '雨';
      m['wx.feels'] = deg(w.feelsLike);
      m['wx.wind'] = compass(w.windDir || 0) + ' ' + Math.round(w.windKmh || 0) + ' km/h';
      m['wx.windU'] = m['wx.wind'].toUpperCase();
      m['wx.cloud'] = String(Math.round(w.cloud || 0));
      m['wx.min'] = deg(today.min);
      m['wx.sunrise'] = hhmm(today.sunrise);
      m['wx.sunset'] = hhmm(today.sunset);
      m['wx.city'] = D.weather.name || (D.settings && D.settings.homeName) || '';
    }
    var w2 = D.weather2 && D.weather2.current;
    if (w2) { m['w2.tc'] = deg(w2.temp) + 'C'; m['w2.text'] = w2.text || ''; }
    var sb = D.soundbar;
    if (sb) {
      if (sb.configured) {
        var on = sb.power !== false;
        m['sb.state'] = on ? 'on' : 'off';
        m['sb.stateCap'] = on ? 'On' : 'Off';
        m['sb.stateU'] = on ? 'ONLINE' : 'STANDBY';
        if (sb.volume !== undefined) m['sb.vol'] = String(sb.volume);
      } else {
        // HW-J355 (no HDMI, no Wi-Fi): it wakes itself via Auto Power Link (optical) or Bluetooth Power On.
        m['sb.state'] = 'auto-on'; m['sb.stateCap'] = 'Auto-on'; m['sb.stateU'] = 'AUTO LINK'; m['sb.vol'] = 'soundbar remote';
      }
    }
    var sys = D.system;
    if (sys && sys.wifi) {
      m['sys.mbps'] = sys.wifi.ethernet ? 'LAN' : String(sys.wifi.linkSpeedMbps || '–');
      m['sys.wifiWord'] = ['weak', 'fair', 'good', 'strong', 'strong'][Math.max(0, Math.min(4, sys.wifi.signalLevel || 0))];
    }
    document.querySelectorAll('[data-b]').forEach(function (el) {
      var k = el.getAttribute('data-b');
      if (m[k] !== undefined) el.textContent = m[k];
    });
  }

  /* ---------------- screensaver mode: no bridge, weather straight from Open-Meteo ---------------- */
  function wmo(c) {
    if (c === 0) return 'Clear'; if (c === 1) return 'Mainly clear'; if (c === 2) return 'Partly cloudy'; if (c === 3) return 'Cloudy';
    if (c === 45 || c === 48) return 'Fog'; if (c >= 51 && c <= 57) return 'Drizzle'; if (c >= 61 && c <= 67) return 'Rain';
    if (c >= 71 && c <= 77) return 'Snow'; if (c >= 80 && c <= 82) return 'Showers'; if (c === 85 || c === 86) return 'Snow showers';
    if (c >= 95) return 'Thunderstorm'; return '';
  }
  function loadDream() {
    D.settings = { homeName: Q.get('city') || 'Ottawa', secondName: Q.get('home') || 'Amritsar', secondTz: Q.get('tz') || 'Asia/Kolkata' };
    D.store = {}; D.apps = []; D.cw = { items: [] };
    var lat = Q.get('lat') || '45.4215', lon = Q.get('lon') || '-75.6972';
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=4';
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var c = j.current || {}, d = j.daily || {};
      D.weather = { name: D.settings.homeName,
        current: { temp: c.temperature_2m, feelsLike: c.apparent_temperature, code: c.weather_code, text: wmo(c.weather_code),
          windKmh: c.wind_speed_10m, windDir: c.wind_direction_10m, cloud: c.cloud_cover, isDay: !!c.is_day },
        daily: (d.time || []).map(function (t, i) { return { date: t, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
          sunrise: d.sunrise[i], sunset: d.sunset[i], code: d.weather_code[i], text: wmo(d.weather_code[i]) }; }) };
    }).catch(function (e) { console.warn('dream weather', e); });
  }
  function dreamDrift() {
    var el = document.querySelector('.wa-time'), k = document.querySelector('.wa-kou');
    var dx = (Math.random() * 3 - 1.5).toFixed(2) + 'cqw', dy = (Math.random() * 2.4 - 1.2).toFixed(2) + 'cqw';
    [el, k].forEach(function (x) { if (x) x.style.transform = 'translate(' + dx + ',' + dy + ')'; });
  }

  /* ---------------- loading ---------------- */
  function loadAll() {
    if (DREAM) return loadDream();
    var S = TvHome.safe;
    return Promise.all([
      S('settings.get', {}, {}), S('apps', {}, []), S('continueWatching', {}, { items: [] }),
      S('soundbar.status', {}, null), S('system', {}, null), S('stats', {}, null), S('store.get', {}, {})
    ]).then(function (r) {
      D.settings = r[0] || {}; D.apps = r[1] || []; D.cw = r[2] || { items: [] };
      D.soundbar = r[3]; D.system = r[4]; D.stats = r[5]; D.store = r[6] || {};
      var extra = [S('weather', {}, null)];
      if (themeId === 'phulkari') extra.push(S('weatherMulti', { places: [{ name: D.settings.secondName || 'Amritsar', lat: D.settings.secondLat || 31.634, lon: D.settings.secondLon || 74.8723 }] }, []));
      else extra.push(Promise.resolve(null));
      if (['pace', 'callus', 'engine'].indexOf(themeId) >= 0 && D.settings.stravaConfigured) extra.push(S('strava.summary', {}, null));
      else extra.push(Promise.resolve(null));
      if (themeId === 'datenight' && D.settings.tmdbConfigured) extra.push(S('tmdb.picks', { mood: (D.store['datenight.mood'] || 'romantic') }, null));
      else extra.push(Promise.resolve(null));
      return Promise.all(extra);
    }).then(function (r) {
      D.weather = r[0];
      D.weather2 = r[1] && r[1][0];
      D.strava = r[2];
      D.picks = r[3];
    });
  }

  /* ---------------- focus & navigation ---------------- */
  var cur = themeIndex;
  function tiles() { return Array.prototype.slice.call(T.screens[cur].querySelectorAll('[data-tile]')); }
  function setFocus(i) { var n = tiles().length; if (!n) return; T.state[cur] = Math.max(0, Math.min(n - 1, i)); T.render(cur); }

  function move(dir) {
    var list = tiles(); if (!list.length) return;
    var from = list[T.state[cur]] || list[0];
    var a = from.getBoundingClientRect();
    var ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    var best = -1, bestScore = Infinity;
    list.forEach(function (el, i) {
      if (el === from) return;
      var b = el.getBoundingClientRect();
      var bx = b.left + b.width / 2, by = b.top + b.height / 2;
      var dx = bx - ax, dy = by - ay;
      var primary, secondary;
      if (dir === 'left') { if (dx > -4) return; primary = -dx; secondary = Math.abs(dy); }
      else if (dir === 'right') { if (dx < 4) return; primary = dx; secondary = Math.abs(dy); }
      else if (dir === 'up') { if (dy > -4) return; primary = -dy; secondary = Math.abs(dx); }
      else { if (dy < 4) return; primary = dy; secondary = Math.abs(dx); }
      var score = primary + secondary * 2.2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) setFocus(best);
    else if (dir === 'right' && T.state[cur] < list.length - 1) setFocus(T.state[cur] + 1);
    else if (dir === 'left' && T.state[cur] > 0) setFocus(T.state[cur] - 1);
  }

  /* ---------------- actions ---------------- */
  function appById(id) { for (var i = 0; i < T.APPS.length; i++) if (T.APPS[i].id === id) return T.APPS[i]; return null; }
  function appPkg(id) {
    var a = appById(id); if (a && a.pkg) return a.pkg;
    var info = (D.apps || []).find(function (x) { return x.id === id; });
    return info ? info.packageName : null;
  }

  function youtubeSearch(q) {
    return 'intent://www.youtube.com/results?search_query=' + encodeURIComponent(q) +
      '#Intent;scheme=https;package=com.google.android.youtube.tv;end';
  }

  function classify(el) {
    var t = (el.textContent || '').toLowerCase().replace(/\s+/g, ' ');
    if (t.indexOf('surprise us') >= 0) return { type: 'surprise' };
    if (t.indexOf('punjabi hits') >= 0 || t.indexOf('ਪੰਜਾਬੀ ਗੀਤ') >= 0) return { type: 'playlist', key: 'punjabi' };
    if (t.indexOf('dinner music') >= 0) return { type: 'playlist', key: 'dinner' };
    if (T.PICKS) for (var p = 0; p < T.PICKS.length; p++) if (t.indexOf(String(T.PICKS[p].t).toLowerCase()) >= 0) return { type: 'pick', pick: T.PICKS[p] };
    var names = [['paramount', 'paramount'], ['netflix', 'netflix'], ['youtube', 'youtube'], ['disney', 'disney'], ['prime', 'prime']];
    for (var i = 0; i < names.length; i++) if (t.indexOf(names[i][0]) >= 0) return { type: 'app', id: names[i][1] };
    if (t.indexOf('soundbar') >= 0 || t.indexOf('audio') >= 0 || /\bsound\b/.test(t) || t.indexOf('音') >= 0) return { type: 'sound' };
    if (t.indexOf('settings') >= 0 || t.indexOf('system') >= 0 || t.indexOf('設') >= 0) return { type: 'settings' };
    return { type: 'none' };
  }

  function disciplineBlocks() {
    if (themeId !== 'callus' || !D.store['callus.discipline']) return false;
    var e = earned();
    return e.earnedMin - e.usedMin <= 0;
  }

  function activate() {
    var el = tiles()[T.state[cur]]; if (!el) return;
    var c = classify(el);
    if (c.type === 'app') {
      if (disciplineBlocks()) { toast('Earn it first. Log today\'s workout, then it unlocks.'); return; }
      var a = appById(c.id);
      var pkg = appPkg(c.id);
      if (!pkg) { toast('Could not find ' + c.id + ' on this TV'); return; }
      if (a && a.intentUri) TvHome.safe('launchUri', { uri: a.intentUri, packageName: pkg });
      else TvHome.safe('launch', { packageName: pkg });
    } else if (c.type === 'pick') {
      var id = c.pick.appId || (classify({ textContent: c.pick.app }).id);
      var pp = id && appPkg(id);
      if (pp) { TvHome.safe('launch', { packageName: pp }); toast('Opening ' + c.pick.app + '. Search for “' + c.pick.t + '”'); }
      else toast('Find “' + c.pick.t + '” on ' + c.pick.app);
    } else if (c.type === 'surprise') {
      if (!D.settings.tmdbConfigured) { toast('Add a free TMDB key in setup to get real picks'); return; }
      toast('Finding something new…');
      TvHome.safe('tmdb.picks', { mood: D.store['datenight.mood'] || 'romantic', fresh: true }, null).then(function () { location.reload(); });
    } else if (c.type === 'playlist') {
      var lists = D.store.playlists || {};
      var q = lists[c.key] || (c.key === 'punjabi' ? 'punjabi hits playlist' : 'dinner jazz playlist');
      TvHome.safe('launchUri', { uri: q.indexOf('intent:') === 0 || q.indexOf('http') === 0 ? q : youtubeSearch(q), packageName: 'com.google.android.youtube.tv' });
    } else if (c.type === 'sound') {
      openMenu('sound');
    } else if (c.type === 'settings') {
      openMenu();
    }
  }

  /* ---------------- toast ---------------- */
  var toastEl, toastTimer;
  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'tvToast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }
  TvHome.on('mockToast', function (p) { toast(p.text); });

  /* ---------------- quick menu (Menu key / Settings tile) ---------------- */
  var menu = null, menuRows = [], menuRow = 0, menuCol = 0, themePick = themeIndex;
  function buildMenu() {
    menu = document.createElement('div');
    menu.id = 'tvMenu';
    menu.hidden = true;
    document.body.appendChild(menu);
  }
  function rowsDef() {
    var sbOn = D.soundbar && D.soundbar.configured;
    return [
      { key: 'theme', label: 'Theme', items: ['◀', THEMES[themePick][1], '▶', 'Apply'] },
      { key: 'sound', label: 'Soundbar', items: sbOn ? ['On', 'Off', 'Vol −', 'Vol +', 'Night', 'Movie'] : ['Turns on with the TV (Auto Power Link)'] },
      { key: 'bed', label: 'Bedtime', items: ['30 min', '60 min', '90 min', 'Cancel'] },
      { key: 'sys', label: 'TV', items: ['Refresh', 'Android settings', 'Close'] }
    ];
  }
  function drawMenu() {
    menuRows = rowsDef();
    var html = '<div class="mh"><b>Menu</b><span>Arrows to move · OK to choose · Back to close</span></div>';
    menuRows.forEach(function (r, ri) {
      html += '<div class="mr"><span class="ml">' + r.label + '</span><div class="mi">';
      r.items.forEach(function (it, ci) {
        html += '<span class="mb' + (ri === menuRow && ci === menuCol ? ' on' : '') + (r.key === 'theme' && ci === 1 ? ' name' : '') + '">' + it + '</span>';
      });
      html += '</div></div>';
    });
    menu.innerHTML = html;
  }
  function openMenu(rowKey) {
    themePick = themeIndex;
    menuRows = rowsDef();
    menuRow = rowKey ? Math.max(0, menuRows.findIndex(function (r) { return r.key === rowKey; })) : 0;
    menuCol = 0;
    menu.hidden = false;
    drawMenu();
  }
  function closeMenu() { if (menu) menu.hidden = true; }
  function menuOpen() { return menu && !menu.hidden; }
  function menuKey(k) {
    var r = menuRows[menuRow];
    if (k === 'up') { menuRow = (menuRow + menuRows.length - 1) % menuRows.length; menuCol = Math.min(menuCol, menuRows[menuRow].items.length - 1); }
    else if (k === 'down') { menuRow = (menuRow + 1) % menuRows.length; menuCol = Math.min(menuCol, menuRows[menuRow].items.length - 1); }
    else if (k === 'left') menuCol = Math.max(0, menuCol - 1);
    else if (k === 'right') menuCol = Math.min(r.items.length - 1, menuCol + 1);
    else if (k === 'ok') return menuChoose(r.key, menuCol, r.items[menuCol]);
    drawMenu();
  }
  function soundbarRefresh() { return TvHome.safe('soundbar.status', {}, D.soundbar).then(function (s) { D.soundbar = s; binds(); }); }
  function menuChoose(key, col, label) {
    if (key === 'theme') {
      if (col === 0) themePick = (themePick + THEMES.length - 1) % THEMES.length;
      else if (col === 2) themePick = (themePick + 1) % THEMES.length;
      else if (col === 3 || col === 1) { TvHome.safe('settings.set', { theme: THEMES[themePick][0] }); toast('Switching to ' + THEMES[themePick][1]); return; }
      drawMenu(); return;
    }
    if (key === 'sound') {
      if (!(D.soundbar && D.soundbar.configured)) { toast('Your soundbar wakes by itself when the TV sends sound. Volume: soundbar remote.'); return; }
      var v = (D.soundbar && D.soundbar.volume) || 15;
      var p = label === 'On' ? TvHome.call('soundbar.power', { on: true })
        : label === 'Off' ? TvHome.call('soundbar.power', { on: false })
        : label === 'Vol −' ? TvHome.call('soundbar.volume', { level: v - 2 })
        : label === 'Vol +' ? TvHome.call('soundbar.volume', { level: v + 2 })
        : TvHome.call('soundbar.mode', { mode: label === 'Night' ? 'night' : 'surround' });
      p.then(function () { toast('Soundbar: ' + label); return soundbarRefresh(); }, function (e) { toast('Soundbar: ' + e.message); });
      return;
    }
    if (key === 'bed') {
      if (label === 'Cancel') { TvHome.safe('bedtime.cancel'); toast('Bedtime cancelled'); return; }
      TvHome.safe('bedtime', { minutes: parseInt(label, 10) }).then(function () { toast('Bedtime in ' + label + '. Soundbar turns off then.'); });
      closeMenu(); return;
    }
    if (key === 'sys') {
      if (label === 'Refresh') location.reload();
      else if (label === 'Android settings') TvHome.safe('openSystemSettings');
      closeMenu();
    }
  }

  /* ---------------- keys ---------------- */
  var KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'ok', NumpadEnter: 'ok', ' ': 'ok' };
  document.addEventListener('keydown', function (e) {
    var k = KEYMAP[e.key] || (e.keyCode === 23 ? 'ok' : null); // 23 = DPAD_CENTER on some WebViews
    if (!k) return;
    e.preventDefault();
    if (menuOpen()) { menuKey(k); return; }
    if (k === 'ok') activate(); else move(k);
  });
  TvHome.on('menu', function () { if (menuOpen()) closeMenu(); else openMenu(); });
  TvHome.on('back', function () { if (menuOpen()) closeMenu(); });
  TvHome.on('home', function () { closeMenu(); setFocus(0); });
  TvHome.on('soundbar', function (s) { D.soundbar = s; binds(); });
  TvHome.on('themeChanged', function () { /* native reloads the page */ });
  TvHome.on('bedtime', function (p) {
    if (p.phase === 'end') { document.body.classList.add('bed-dim'); toast('Good night'); }
  });
  TvHome.on('colorKey', function (p) {
    if (p.color === 'red') openMenu('theme');
    else if (p.color === 'green') openMenu('sound');
    else if (p.color === 'yellow') openMenu('bed');
  });

  var lastCw = '';
  TvHome.on('resume', function () {
    document.body.classList.remove('bed-dim');
    TvHome.safe('continueWatching', {}, null).then(function (cw) {
      if (!cw) return;
      var sig = JSON.stringify((cw.items || []).map(function (i) { return [i.title, i.progress]; }));
      if (lastCw && sig !== lastCw) location.reload();
    });
    soundbarRefresh();
  });

  /* ---------------- theme extras that use live data ---------------- */
  function earned() {
    var s = D.store || {};
    var trained = D.strava && D.strava.configured ? (D.strava.today && D.strava.today.minutes) || 0 : (s['callus.trainedToday'] || 0);
    var ratio = s['callus.ratio'] || 2;
    var used = D.stats && D.stats.granted ? Math.round((D.stats.todayMs || 0) / 60000) : 62;
    return { trainedMin: trained, earnedMin: trained * ratio, usedMin: used };
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var EXTRAS = {
    callus: function () {
      var s = D.store || {};
      if (D.native) {
        var e = earned();
        var row = document.querySelector('.cl-earn .row span:last-child');
        if (row) row.innerHTML = '<b>' + e.trainedMin + ' min</b> trained → <b>' + e.earnedMin + ' min</b> earned';
        var pct = e.earnedMin ? Math.min(100, Math.round(e.usedMin / e.earnedMin * 100)) : 100;
        var bar = document.querySelector('.cl-bar i'), mk = document.querySelector('.cl-bar s');
        if (bar) bar.style.width = pct + '%'; if (mk) mk.style.left = pct + '%';
        var left = e.earnedMin - e.usedMin;
        var note = document.querySelector('.cl-earn .note');
        if (note) note.innerHTML = left > 0 ? e.usedMin + ' min used. <b>' + left + ' min left</b>, then lights out.'
          : e.usedMin + ' min used. <b>You\'re over by ' + (-left) + ' min.</b> Go train.';
        var streak = (D.strava && D.strava.streakDays) || s['callus.dayCount'];
        if (streak) { var b = document.querySelector('.cl-sub b'); if (b) b.textContent = streak; }
      }
      if (Array.isArray(s['callus.goals']) && s['callus.goals'].length) {
        var colors = ['#ffe36e', '#ffb35c', '#f4f0e6', '#b9f27c'];
        var pos = [[3, 2.5, -4], [15.5, 6, 3], [27.5, 2, -2], [9, 13, 2]];
        var mirror = document.querySelector('.cl-mirror');
        mirror.querySelectorAll('.note2').forEach(function (n) { n.remove(); });
        s['callus.goals'].slice(0, 4).forEach(function (g, i) {
          var txt = typeof g === 'string' ? g : g.text, done = typeof g === 'object' && g.done;
          var p = pos[i];
          mirror.insertAdjacentHTML('afterbegin', '<div class="note2" style="left:' + p[0] + 'cqw;top:' + p[1] + 'cqw;background:' + colors[i] + ';transform:rotate(' + p[2] + 'deg)">' + esc(String(txt).toUpperCase()) + (done ? '<em>DONE</em>' : '') + '</div>');
        });
      }
      if (Array.isArray(s['callus.wins']) && s['callus.wins'].length) {
        document.querySelector('.cl-jar').innerHTML = '<span class="lb">COOKIE JAR</span>' +
          s['callus.wins'].map(function (w) { return '<span>' + esc(w) + '</span>'; }).join('<i>/</i>');
      }
    },
    pace: function () {
      var s = D.store || {};
      var race = s['pace.race'];
      if (race) {
        if (race.name) document.querySelector('.pa-bib .band span').textContent = String(race.name).toUpperCase();
        if (race.bib) document.querySelector('.pa-bib .num').textContent = race.bib;
        if (race.distance || race.goal) document.querySelector('.pa-bib .meta').textContent = (race.distance || '42.2 KM') + (race.goal ? ' · GOAL ' + race.goal : '');
        if (race.date) {
          var dt = new Date(race.date + 'T07:00:00');
          var n = Math.ceil((dt - new Date()) / 864e5);
          document.getElementById('paDays').textContent = n + ' DAYS';
          document.querySelector('.pa-bib .tear span').innerHTML = 'TO RACE DAY<br>' + dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
        }
      }
      if (Array.isArray(s['pace.plan']) && s['pace.plan'].length === 7) {
        var today = (new Date().getDay() + 6) % 7, days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
        document.getElementById('paWeek').innerHTML = s['pace.plan'].map(function (p, k) {
          return '<div class="d ' + (k === today ? 'td' : k < today ? 'done' : '') + '"><small>' + days[k] + '</small><b>' + esc(p[0]) + '</b><span>' + esc(p[1] || '') + '</span></div>';
        }).join('');
      }
      var st = D.strava;
      if (st && st.configured) {
        var target = s['pace.weekTargetKm'] || 61, km = st.week.runKm, pct = Math.min(100, Math.round(km / target * 100));
        var box = document.querySelectorAll('.pa-box')[0];
        box.querySelector('.v').textContent = km + ' / ' + target + ' km';
        box.querySelector('.s').textContent = st.week.runs + ' runs this week';
        var arc = box.querySelectorAll('circle')[1]; arc.setAttribute('stroke-dasharray', (62.8 * pct / 100).toFixed(1) + ' 62.8');
        box.querySelector('text').textContent = pct + '%';
        var lr = st.lastRun;
        if (lr) {
          var pace = lr.paceSPerKm, mm = Math.floor(pace / 60), ss = String(pace % 60).padStart(2, '0');
          var hh = Math.floor(lr.movingS / 3600), mi = Math.floor(lr.movingS % 3600 / 60), se = lr.movingS % 60;
          var dur = (hh ? hh + ':' + String(mi).padStart(2, '0') : mi) + ':' + String(se).padStart(2, '0');
          var when = new Date(lr.date.replace('Z', '')).toLocaleDateString([], { weekday: 'long' }).toUpperCase();
          var txt = document.querySelector('.pa-splits .txt');
          txt.innerHTML = '<div class="lb">LAST RUN · ' + when + '</div><b>' + lr.km + ' km · ' + dur + '</b><div class="lb" style="margin-top:.2cqw">' + mm + ':' + ss + ' /KM AVG</div>';
          if (lr.splits && lr.splits.length) {
            var mx = Math.max.apply(null, lr.splits), mn = Math.min.apply(null, lr.splits);
            document.getElementById('paBars').innerHTML = lr.splits.slice(0, 26).map(function (v) {
              var h = mx === mn ? 70 : 30 + (mx - v) / (mx - mn) * 70;
              return '<i class="' + (v === mn ? 'best' : '') + '" style="height:' + h.toFixed(0) + '%"></i>';
            }).join('');
          }
        }
      }
    },
    engine: function () {
      var st = D.strava;
      if (st && st.configured && st.weeks) {
        var mx = Math.max.apply(null, st.weeks.map(function (w) { return w.minutes; }).concat([60]));
        var s = '';
        st.weeks.forEach(function (w, k) {
          var x = 6 + k * 19, h = w.minutes / mx * 26;
          s += '<rect x="' + x + '" y="' + (30 - h) + '" width="11" height="' + h + '" rx="1.2" fill="' + (k === 5 ? '#12a37f' : '#cfe9df') + '"/>' +
            '<text x="' + (x + 5.5) + '" y="33.4" font-size="2.2" text-anchor="middle" fill="#6d7a73" font-family="Red Hat Display">' + Math.round(w.minutes / 60) + 'h</text>';
        });
        document.getElementById('enLoad').innerHTML = s;
        var prev = st.weeks.slice(1, 5).reduce(function (a, w) { return a + w.minutes; }, 0) / 4 || 1;
        var acr = (st.weeks[5].minutes / prev).toFixed(2);
        var zone = acr < 0.8 ? 'detraining' : acr <= 1.3 ? 'sweet spot' : acr <= 1.5 ? 'caution' : 'injury risk';
        document.querySelector('.en-load .pill').textContent = 'Acute : chronic ' + acr + ' · ' + zone;
      }
      var t = (D.store || {})['engine.today'];
      if (t) {
        var vals = document.querySelectorAll('.en-ring text');
        if (t.recovery !== undefined && vals[0]) vals[0].textContent = t.recovery + '%';
        if (t.strain !== undefined && vals[1]) vals[1].textContent = t.strain;
        if (t.sleep && vals[2]) vals[2].textContent = t.sleep;
      }
    },
    loadout: function () {
      var st = D.stats; if (!st || !st.granted) return;
      var h = Math.round((st.yearMs || 0) / 3600000);
      var lvl = Math.floor(Math.sqrt(h) * 2.4) + 1;
      var cur0 = Math.pow((lvl - 1) / 2.4, 2), next = Math.pow(lvl / 2.4, 2);
      var frac = Math.max(0, Math.min(1, (h - cur0) / (next - cur0)));
      document.querySelector('.hu-lv b').textContent = lvl;
      document.getElementById('huXp').innerHTML = Array.from({ length: 20 }, function (_, k) { return '<i class="' + (k < Math.round(frac * 20) ? 'f' : '') + '"></i>'; }).join('');
      var kv = document.querySelector('.hu-kv b'); if (kv) kv.textContent = h + ' / ' + Math.ceil(next) + ' H';
      var top = { netflix: 'Netflix', youtube: 'YouTube', disney: 'Disney+', prime: 'Prime Video', paramount: 'Paramount+' }[st.topApp];
      var stats = document.querySelectorAll('.hu-stats b'); if (top && stats[2]) stats[2].textContent = top;
    },
    sora: function () {
      var st = D.stats; if (!st || !st.granted || !st.last7Days) return;
      var labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      var start = new Date(); start.setDate(start.getDate() - 6);
      document.getElementById('soDots').innerHTML = st.last7Days.map(function (ms, k) {
        var d = new Date(start); d.setDate(start.getDate() + k);
        var cls = ms >= 15 * 60000 ? 'f' : k === 6 ? 't' : '';
        return '<span class="' + cls + '">' + labels[d.getDay()] + '</span>';
      }).join('');
      var b = document.querySelectorAll('.so-w b')[1];
      if (b) b.textContent = st.streakDays + ' day' + (st.streakDays === 1 ? '' : 's') + (st.last7Days[6] >= 15 * 60000 ? ' · today counted' : ' · watch tonight to keep it');
    },
    datenight: function () {
      (T.PICKS || []).forEach(function (p, i) {
        var el = document.querySelectorAll('.pick')[i];
        if (el && p.poster) el.style.background = 'linear-gradient(0deg,rgba(0,0,0,.2),rgba(0,0,0,0)),url("' + p.poster + '") center/cover';
        if (el && p.poster) { var sun = el.querySelector('.sun'); if (sun) sun.remove(); }
      });
      var ann = (D.store || {})['datenight.anniversary'];
      if (ann) {
        var md = String(ann).slice(5), now = new Date(), d = new Date(now.getFullYear() + '-' + md + 'T00:00:00');
        if (d < now) d.setFullYear(d.getFullYear() + 1);
        document.getElementById('dnAnn').textContent = Math.ceil((d - now) / 864e5);
      }
      var mood = (D.store || {})['datenight.mood'];
      if (mood) document.querySelectorAll('.dn-mood span').forEach(function (s) { s.classList.toggle('a', s.textContent.toLowerCase() === mood); });
    },
    marquee: function () {
      // Use the real poster art behind the hero when an app has one.
      var orig = T.hooks[0];
      T.hooks[0] = function (i) {
        orig(i);
        var a = T.APPS[i];
        if (a && a.poster) document.getElementById('mqBg').style.background = 'url("' + a.poster + '") right top/65% auto no-repeat, #000';
      };
    },
    washi: function () {
      var s = D.settings || {};
      var forced = (D.store || {})['washi.season'];
      if (forced && forced !== 'auto' && window.waSeason) window.waSeason(forced);
      window.__homeName = s.secondName || 'Amritsar';
      window.__homeTz = s.secondTz || 'Asia/Kolkata';
      var w = D.weather;
      if (w && w.daily && w.daily.length) {
        var dd = w.daily, html = '<span>Today ' + deg(dd[0].min) + ' / ' + deg(dd[0].max) + '</span>';
        for (var i = 1; i < Math.min(4, dd.length); i++) {
          var day = new Date(dd[i].date + 'T12:00:00').toLocaleDateString([], { weekday: 'short' });
          html += '<span>' + day + ' <b>' + deg(dd[i].max) + '</b></span>';
        }
        document.getElementById('waFc').innerHTML = html;
        var hrs = function (iso) { return iso && iso.length >= 16 ? +iso.slice(11, 13) + (+iso.slice(14, 16)) / 60 : null; };
        window.__waSun = [hrs(dd[0].sunrise), hrs(dd[0].sunset)];
        if (window.waLight) window.waLight(window.__waSun[0], window.__waSun[1]);
      }
      // 今夜: the newest "next episode" / "new" item Android TV knows about, else the latest show in progress.
      var items = (D.cw && D.cw.items) || [];
      var pick = items.find(function (x) { return x.watchNextType === 1 || x.watchNextType === 2; }) || items[0];
      if (pick && D.native) {
        var app = (D.apps || []).find(function (a) { return a.packageName === pick.packageName; });
        document.getElementById('waTonight').innerHTML = esc(pick.title || '') + '<small>' +
          (pick.watchNextType === 2 ? 'New episode' : pick.watchNextType === 1 ? 'Next episode' : 'Pick up where you left off') +
          (app ? ' · ' + esc(app.label) : '') + '</small>';
      }
      if (s.bedtime) document.getElementById('waBed').innerHTML = 'Bedtime ' + esc(s.bedtime) + '<small>Menu → Bedtime for a timer</small>';
    },
    phulkari: function () {
      var s = D.settings || {};
      var labels = document.querySelectorAll('.pc small');
      if (labels[0] && s.homeName) labels[0].textContent = s.homeName;
      if (labels[1] && s.secondName) labels[1].textContent = s.secondName;
    }
  };

  /* ---------------- boot ---------------- */
  function boot() {
    buildMenu();
    loadAll().catch(function (e) { console.error(e); }).then(function () {
      T = window.__buildThemes();
      T.screens.forEach(function (s, k) { s.hidden = k !== cur; });
      document.body.setAttribute('data-theme-id', themeId);
      if (DREAM) { document.body.classList.add('dream'); dreamDrift(); setInterval(dreamDrift, 60000); }
      binds();
      try { if (EXTRAS[themeId]) EXTRAS[themeId](); } catch (e) { console.error('extras', e); }
      if (themeId === 'forge') { var f = document.getElementById('fg'); if (f) f.classList.add('boot'); }
      T.render(cur);
      lastCw = JSON.stringify(((D.cw && D.cw.items) || []).map(function (i) { return [i.title, i.progress]; }));
      document.body.classList.add('ready');
      if (DREAM) return;
      if (D.native && D.cw && D.cw.permission === false) toast('Allow "TV listings" for continue watching (see SETUP.md)');
    });
    // Weather every 20 min, soundbar + system every 2 min.
    if (DREAM) { setInterval(function () { loadDream().then(binds); }, 20 * 60000); return; }
    setInterval(function () { TvHome.safe('weather', {}, null).then(function (w) { if (w) { D.weather = w; binds(); } }); }, 20 * 60000);
    setInterval(function () {
      Promise.all([TvHome.safe('soundbar.status', {}, D.soundbar), TvHome.safe('system', {}, D.system)]).then(function (r) { D.soundbar = r[0]; D.system = r[1]; binds(); });
    }, 2 * 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
