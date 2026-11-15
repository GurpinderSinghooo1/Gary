/*
 * tvhome.js: the page's connection to the Android side.
 *
 * On the TV, Kotlin injects `window.TvBridge`. We call TvBridge.request(method, argsJson, callbackId)
 * and Kotlin answers through TvHome.resolve(callbackId, {ok, data|error}). Kotlin also pushes
 * events through TvHome.emit(name, payload): back, menu, home, resume, screenOn, soundbar,
 * themeChanged, bedtime, colorKey.
 *
 * In a normal desktop browser there is no bridge, so a mock answers with sample data. That lets
 * every theme be previewed and tweaked on a laptop (open home.html?theme=pace).
 */
(function () {
  'use strict';
  var native = typeof window.TvBridge !== 'undefined' && window.TvBridge && typeof window.TvBridge.request === 'function';
  var pending = {};
  var seq = 0;
  var listeners = {};

  var TvHome = {
    native: native,

    /** Call a native method. Resolves with `data`, rejects with an Error. */
    call: function (method, args) {
      args = args || {};
      if (!native) return Mock.call(method, args);
      return new Promise(function (resolve, reject) {
        var id = 'c' + (++seq);
        pending[id] = { resolve: resolve, reject: reject };
        setTimeout(function () {
          if (pending[id]) { delete pending[id]; reject(new Error('Timed out: ' + method)); }
        }, 25000);
        try { window.TvBridge.request(method, JSON.stringify(args), id); }
        catch (e) { delete pending[id]; reject(e); }
      });
    },

    /** Same as call() but never rejects: returns `fallback` on any error. */
    safe: function (method, args, fallback) {
      return TvHome.call(method, args).catch(function (e) {
        console.warn('[tvhome] ' + method + ' failed: ' + e.message);
        return fallback === undefined ? null : fallback;
      });
    },

    resolve: function (id, result) {
      var p = pending[id];
      if (!p) return;
      delete pending[id];
      if (result && result.ok) p.resolve(result.data);
      else p.reject(new Error((result && result.error) || 'Unknown error'));
    },

    emit: function (name, payload) {
      (listeners[name] || []).slice().forEach(function (fn) {
        try { fn(payload || {}); } catch (e) { console.error(e); }
      });
    },

    on: function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); }
  };

  /* ---------------- Mock for desktop preview ---------------- */
  var mockStore = {};
  try { mockStore = JSON.parse(localStorage.getItem('tvhome.mockStore') || '{}'); } catch (e) { mockStore = {}; }
  var mockSettings = { theme: 'phulkari', homeName: 'Ottawa', secondName: 'Amritsar', secondTz: 'Asia/Kolkata',
    autoSoundbar: true, smartthingsConfigured: false, stravaConfigured: false, tmdbConfigured: false, region: 'CA', units: 'metric' };

  function day(off) { var d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); }
  var Mock = {
    call: function (method, a) {
      var r;
      switch (method) {
        case 'apps': r = [
          { id: 'netflix', packageName: 'com.netflix.ninja', label: 'Netflix', installed: true },
          { id: 'youtube', packageName: 'com.google.android.youtube.tv', label: 'YouTube', installed: true },
          { id: 'disney', packageName: 'com.disney.disneyplus', label: 'Disney+', installed: true },
          { id: 'prime', packageName: 'com.amazon.amazonvideo.livingroom', label: 'Prime Video', installed: true },
          { id: 'paramount', packageName: 'com.cbs.ott', label: 'Paramount+', installed: true }]; break;
        case 'continueWatching': r = { items: [], permission: true, mock: true }; break;
        case 'weather': case 'weatherMulti':
          var w = function (name, t, code, text) {
            return { name: name, current: { temp: t, feelsLike: t - 5, code: code, text: text, windKmh: 18, windDir: 315, cloud: 80, isDay: false },
              daily: [0, 1, 2, 3, 4].map(function (i) { return { date: day(i), code: code, text: text, max: t + 2 - i, min: t - 5 - i, sunrise: day(i) + 'T06:59', sunset: day(i) + 'T16:33', rainChance: 20 }; }) };
          };
          r = method === 'weather' ? w(a.name || 'Ottawa', 2, 3, 'Cloudy') : [w('Ottawa', 2, 3, 'Cloudy'), w('Amritsar', 11, 0, 'Clear')]; break;
        case 'soundbar.status': r = { configured: false, method: 'cec' }; break;
        case 'stats': r = { granted: true, todayMs: 62 * 60000, weekMs: 9.3 * 3600000, yearMs: 312 * 3600000,
          last7Days: [40, 95, 0, 120, 60, 75, 62].map(function (m) { return m * 60000; }), streakDays: 6, topApp: 'netflix' }; break;
        case 'system': r = { wifi: { connected: true, linkSpeedMbps: 412, signalLevel: 4 }, storage: { freeBytes: 5.1e9, totalBytes: 8e9 } }; break;
        case 'settings.get': r = mockSettings; break;
        case 'settings.set': Object.assign(mockSettings, a); if (a.theme) { var u = new URL(location.href); u.searchParams.set('theme', a.theme); location.href = u.toString(); } r = mockSettings; break;
        case 'store.get': r = a.key ? (mockStore[a.key] === undefined ? null : mockStore[a.key]) : mockStore; break;
        case 'store.set': mockStore[a.key] = a.value; try { localStorage.setItem('tvhome.mockStore', JSON.stringify(mockStore)); } catch (e) {} r = true; break;
        case 'strava.summary': r = { configured: false }; break;
        case 'tmdb.picks': return Promise.reject(new Error('TMDB key not set'));
        case 'launch': case 'launchUri': case 'openSystemSettings':
          console.log('[mock] ' + method, a); TvHome.emit('mockToast', { text: 'Would open: ' + (a.packageName || a.uri || 'Settings') }); r = true; break;
        case 'bedtime': r = { endsAt: Date.now() + a.minutes * 60000 }; break;
        default: r = true;
      }
      return new Promise(function (res) { setTimeout(function () { res(JSON.parse(JSON.stringify(r))); }, 30); });
    }
  };

  window.TvHome = TvHome;
})();
