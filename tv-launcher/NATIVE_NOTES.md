# TV Home - native Android notes

Not built locally (no Android SDK in the sandbox); written to compile in CI with AGP 9.5.0 (built-in Kotlin), Gradle 9.9.1, JDK 21.

## Files
- settings.gradle.kts, build.gradle.kts, gradle.properties, gradle/libs.versions.toml, .gitignore
- app/build.gradle.kts, app/src/main/AndroidManifest.xml
- res: values/strings.xml, values/themes.xml, drawable/ic_launcher.xml, drawable/banner.xml
- kotlin (com.gary.tvhome): TvHomeApp.kt, HomeActivity.kt, Bridge.kt (TvBridge),
  web/LocalPathHandlers.kt, data/{Prefs,AppRepository,WatchNextRepository,WeatherRepository,StatsRepository,SystemInfo}.kt,
  soundbar/{SoundbarManager,SmartThingsClient}.kt, boot/BootReceiver.kt

## Page URL and path handlers (https://appassets.androidplatform.net)
- Page: `/assets/web/home.html?theme=<themeId>` (assets/web/home.html must exist)
- `/icon/<pkg>` PNG 192x192, `/banner/<pkg>` PNG 320x180 (falls back to centred icon)
- `/art/<base64url(uri)>` content:// or android.resource:// images (Watch Next posters)

## JS side contract
- `TvBridge.isNative()`, `TvBridge.version()` (sync).
- `TvBridge.request(method, argsJson, callbackId)`; native calls
  `window.TvHome && TvHome.resolve(callbackId, {"ok":true,"data":...} | {"ok":false,"error":"msg"})`.
- Native pushes events with `window.TvHome && TvHome.emit(name, payloadObject)`.

### request() methods (args -> data)
- `apps` {} -> `[{id,packageName,label,installed,iconUrl,bannerUrl}]` (known: netflix, youtube, disney, prime, paramount first; then all other launchable apps by label). Hidden apps are NOT filtered natively.
- `launch` {packageName} -> bool (Play Store market:// if not installed)
- `launchUri` {uri, packageName?} -> bool
- `continueWatching` {} -> `{items:[{title,episodeTitle,season,episode,packageName,progress,durationMs,positionMs,posterUrl,intentUri,lastEngagementMs,watchNextType}], permission:bool}` (max 20, newest first; null for missing strings)
- `weather` {lat?,lon?,name?} -> `{name,current:{temp,feelsLike,code,text,windKmh,windDir,cloud,isDay},daily:[{date,code,text,max,min,sunrise,sunset,rainChance}]}` (defaults to home location; temps in F if units=imperial)
- `weatherMulti` {places:[{name,lat,lon}]} -> array of the above (an entry has `error` if it failed)
- `soundbar.status` -> `{configured:false,method:"cec",note}` or `{configured:true,method:"smartthings",power?,volume?,mute?}`
- `soundbar.power` {on} -> `{power}`; `soundbar.volume` {level} -> `{volume}`; `soundbar.mute` {mute} -> `{mute}`; `soundbar.mode` {mode} -> `{mode}` (experimental); `soundbar.devices` -> `[{deviceId,label,name}]`. All error with "Soundbar not configured..." when no SmartThings.
- `stats` -> `{granted:false}` or `{granted:true,todayMs,weekMs,yearMs,all:{todayMs,weekMs,yearMs},perApp:{pkg:yearMs},perAppId:{netflix:yearMs,...},last7Days:[ms x7 oldest->newest],streakDays,topApp:<known app id or null>}` (streaming apps only, except `all`)
- `system` -> `{wifi:{connected,ssid,rssi,linkSpeedMbps,signalLevel,ethernet},storage:{freeBytes,totalBytes},device:{model,manufacturer,android,sdk},uptimeMs,adsBlocked,timeZone}`
- `settings.get` -> `{theme,homeName,homeLat,homeLon,secondName,secondLat,secondLon,secondTz,autoSoundbar,smartthingsConfigured,smartthingsDeviceId,bedtime,units,favorites:[],hiddenApps:[]}` (token never returned)
- `settings.set` partial object (may include smartthingsToken) -> new settings.get object; theme change emits `themeChanged` and reloads the page.
- `openSystemSettings` -> bool; `openAppInfo` {packageName} -> bool
- `bedtime` {minutes} -> `{endsAt}`; `bedtime.cancel` -> true

### Events (TvHome.emit)
`back`, `menu` (MENU/SETTINGS/GUIDE), `colorKey` {color:"red|green|yellow|blue"}, `resume`, `home` (HOME pressed while already home), `screenOn`, `soundbar` (status object), `themeChanged` {theme}, `bedtime` {phase:"start",endsAt} / {phase:"end"}.

## adb permissions
- `adb shell pm grant com.gary.tvhome android.permission.READ_TV_LISTINGS` (continue watching)
- `adb shell appops set com.gary.tvhome GET_USAGE_STATS allow` (stats)
- Optionally set as home app via the system chooser.

## Unsure / caveats
- Back is intercepted in dispatchKeyEvent; manifest sets enableOnBackInvokedCallback=false (targetSdk 36 otherwise ignores onBackPressed).
- UsageStats daily buckets only retained ~7-10 days: streak is capped; yearMs uses the yearly bucket (best effort).
- READ_TV_LISTINGS is privileged on many devices; the runtime request may be silently denied (use adb).
- WatchNextProgram.seasonNumber/episodeNumber may be deprecated getters (warnings only); converted with toString().
- SmartThings sound-mode via `execute` is model-dependent.
- WebView JS uses a TvHome object that the HTML must define (emit/resolve).
- adsBlocked is a pref placeholder (always 0). Prefs `askedTvListings` stores first-run state.

---

## Additions after the first pass

**New request() methods**
- `store.get` {key?} → value for key (any JSON) or, without key, all stored values as an object.
- `store.set` {key, value} → true. Keys: `[A-Za-z0-9_.-]{1,64}`. `null` deletes.
- `strava.summary` {force?} → `{configured:false}` or `{configured:true, today:{minutes}, week:{runKm,runs,minutes,startDate},
  weeks:[{start,km,minutes}×6 oldest first], lastRun:{name,date,km,movingS,paceSPerKm,splits:[s/km]}|null, streakDays, fetchedAt}`. Cached 10 min.
- `tmdb.picks` {mood: romantic|funny|thriller|cozy|action, count 1-6, fresh?} → `[{id,title,overview,year,rating,runtimeMin,genres,posterUrl,backdropUrl,provider,appId}]`,
  limited to Netflix / Prime Video / Disney+ / Paramount+ in `region` (default CA). Cached 6 h.
- `smartthings.scenes` → `[{sceneId,name}]`; `smartthings.runScene` {sceneId} → true.
- `soundbar.devices` now needs only SmartThings auth (no device id yet), so setup can list devices.

**SmartThings auth**: `soundbar/SmartThingsAuth.kt`. OAuth (client id/secret + rotating single-use refresh token, saved with
`commit()` before use) is preferred; a personal access token still works but expires after 24 h for tokens made since Dec 2024.

**Wake logic**: `ensureOn()` is debounced 30 s and retries at 0/4/12/30 s because Wi-Fi reconnects slowly after standby.
Screen-on respects the `autoSoundbar` pref.

**adb config push**: `setup/SetupReceiver.kt`, guarded by `android.permission.DUMP` (only shell/system hold it).
`tools/push-config.sh` sends `{settings:{...}, store:{...}}` as base64.

**Verified locally**: all Kotlin compiles (kotlinc 2.1.21) against the real Android 15 framework (Robolectric android-all)
with hand-written stubs for the three androidx libraries. Not verified: the real androidx signatures (stubs) and the Gradle/AGP build.

---

## Third pass (review and hardening)

**HOME / default launcher.** Google TV resolves HOME to `com.google.android.tungsten.setupwraith`, which forwards
to `launcherx`; that is why the default-home setting looked ignored and why disabling only `launcherx` looped the
wizard. `tools/make-default.sh` disables both, tests HOME with `input keyevent`, and rolls back on failure.
`HomeButtonService` remains as a backup. Not yet confirmed on the Hisense itself (no adb from the build sandbox).

**New request() methods**
- `inputs` → `[{id,label,connected}]` (TvInputManager passthrough inputs); `launchInput` {id} → bool.
- `settings.get` adds `canSleepTv` (true while `HomeButtonService` is connected).
- `bedtime` end now also calls `performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)` through the service: the TV sleeps.
- `apps` no longer lists Google's home-screen packages.

**Keys.** `back` / `menu` / `colorKey` are emitted on key-up only when the key-down was also seen by HomeActivity,
so the BACK that closes another app no longer opens the menu.

**Page.** Loads in two steps (`loadLocal`, then `loadNet`): first paint waits at most 1.2 s for the network, weather
falls back to the last forecast (localStorage, 3 h) or dashes, never the design's sample numbers. Google Fonts load
non-blocking. Polling stops while another app is in front (`document.hidden`).
