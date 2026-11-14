package com.gary.tvhome

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.webkit.JavascriptInterface
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * JavaScript bridge exposed to the page as `TvBridge`.
 * JS calls request(method, argsJson, callbackId); the result is delivered back through
 * window.TvHome.resolve(callbackId, {"ok":true,"data":...} | {"ok":false,"error":"..."}).
 * Thin layer: the work lives in the repositories on TvHomeApp.
 */
class TvBridge(private val activity: HomeActivity) {
    private val app: TvHomeApp get() = activity.app
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun destroy() {
        scope.cancel()
    }

    @JavascriptInterface
    fun isNative(): Boolean = true

    @JavascriptInterface
    fun version(): String = BuildConfig.VERSION_NAME

    @JavascriptInterface
    fun request(method: String, argsJson: String, callbackId: String) {
        scope.launch {
            val result = JSONObject()
            try {
                val args = try {
                    if (argsJson.isBlank()) JSONObject() else JSONObject(argsJson)
                } catch (_: Exception) {
                    JSONObject()
                }
                val data = dispatch(method, args)
                result.put("ok", true).put("data", data ?: JSONObject.NULL)
            } catch (e: Exception) {
                val r = JSONObject()
                r.put("ok", false).put("error", e.message ?: e.javaClass.simpleName)
                deliver(callbackId, r)
                return@launch
            }
            deliver(callbackId, result)
        }
    }

    private fun deliver(callbackId: String, result: JSONObject) {
        activity.evalJs("window.TvHome && TvHome.resolve(${JSONObject.quote(callbackId)}, $result)")
    }

    private suspend fun dispatch(method: String, a: JSONObject): Any? = when (method) {
        "apps" -> app.appRepository.list()
        "launch" -> launchApp(a.optString("packageName"))
        "launchUri" -> launchUri(a.optString("uri"), a.optString("packageName"))
        "continueWatching" -> app.watchNextRepository.query()
        "weather" -> {
            val p = app.prefs
            val lat = if (a.has("lat")) a.getDouble("lat") else p.homeLat
            val lon = if (a.has("lon")) a.getDouble("lon") else p.homeLon
            val name = if (a.has("name")) a.optString("name") else if (a.has("lat")) "" else p.homeName
            app.weatherRepository.get(name, lat, lon)
        }
        "weatherMulti" -> app.weatherRepository.getMulti(a.optJSONArray("places") ?: JSONArray())
        "soundbar.status" -> app.soundbarManager.status()
        "soundbar.power" -> app.soundbarManager.power(a.optBoolean("on", true))
        "soundbar.volume" -> app.soundbarManager.volume(a.getInt("level"))
        "soundbar.mute" -> app.soundbarManager.mute(a.optBoolean("mute", true))
        "soundbar.mode" -> app.soundbarManager.mode(a.getString("mode"))
        "soundbar.devices" -> app.soundbarManager.devices()
        "stats" -> app.statsRepository.get()
        "store.get" -> if (a.has("key")) app.store.get(a.getString("key")) else app.store.all()
        "store.set" -> { app.store.set(a.getString("key"), a.opt("value")); true }
        "strava.summary" -> app.strava.summary(a.optBoolean("force", false))
        "tmdb.picks" -> app.tmdb.picks(a.optString("mood", "romantic"), a.optInt("count", 3).coerceIn(1, 6), a.optBoolean("fresh", false))
        "smartthings.scenes" -> app.soundbarManager.scenes()
        "smartthings.runScene" -> app.soundbarManager.runScene(a.getString("sceneId"))
        "system" -> app.systemInfo.get()
        "settings.get" -> app.prefs.toJson()
        "settings.set" -> settingsSet(a)
        "openSystemSettings" -> startSafely(Intent(Settings.ACTION_SETTINGS))
        "openAppInfo" -> openAppInfo(a.optString("packageName"))
        "bedtime" -> bedtime(a.optInt("minutes", 0))
        "bedtime.cancel" -> {
            app.bedtimeJob?.cancel()
            app.bedtimeJob = null
            true
        }
        else -> throw IllegalArgumentException("Unknown method: $method")
    }

    private fun startSafely(intent: Intent): Boolean = try {
        app.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (_: Exception) {
        false
    }

    private fun launchApp(pkg: String): Boolean {
        if (pkg.isBlank()) return false
        val intent = app.appRepository.launchIntent(pkg)
        if (intent != null) return startSafely(intent)
        return try {
            val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg"))
            app.startActivity(market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (_: ActivityNotFoundException) {
            false
        }
    }

    private fun launchUri(uri: String, pkg: String): Boolean {
        if (uri.isNotBlank()) {
            try {
                val intent = Intent.parseUri(uri, Intent.URI_INTENT_SCHEME)
                app.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return true
            } catch (_: Exception) {
                // fall through to launching the package
            }
        }
        return launchApp(pkg)
    }

    private fun openAppInfo(pkg: String): Boolean {
        if (pkg.isBlank()) return false
        val i = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))
        return startSafely(i)
    }

    private fun settingsSet(a: JSONObject): JSONObject {
        val themeChanged = app.prefs.merge(a)
        if (themeChanged) {
            activity.emit("themeChanged", JSONObject().put("theme", app.prefs.theme).toString())
            activity.reloadTheme()
        }
        return app.prefs.toJson()
    }

    private fun bedtime(minutes: Int): JSONObject {
        if (minutes <= 0) throw IllegalArgumentException("minutes must be > 0")
        app.bedtimeJob?.cancel()
        val endsAt = System.currentTimeMillis() + minutes * 60_000L
        app.bedtimeJob = app.appScope.launch {
            delay(minutes * 60_000L)
            try {
                if (app.prefs.smartthingsConfigured) app.soundbarManager.power(false)
            } catch (_: Exception) {
            }
            HomeActivity.current()?.emit("bedtime", JSONObject().put("phase", "end").toString())
        }
        HomeActivity.current()?.emit(
            "bedtime", JSONObject().put("phase", "start").put("endsAt", endsAt).toString()
        )
        return JSONObject().put("endsAt", endsAt)
    }
}
