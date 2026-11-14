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
