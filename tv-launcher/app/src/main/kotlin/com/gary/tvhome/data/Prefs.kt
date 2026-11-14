package com.gary.tvhome.data

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * SharedPreferences wrapper ("tvhome") holding all user settings.
 * toJson() never exposes the SmartThings token; merge() applies a partial JSON object.
 */
class Prefs(context: Context) {
    private val sp: SharedPreferences =
        context.applicationContext.getSharedPreferences("tvhome", Context.MODE_PRIVATE)

    private fun str(key: String, def: String): String = sp.getString(key, def) ?: def
    private fun putStr(key: String, v: String) = sp.edit().putString(key, v).apply()
    private fun dbl(key: String, def: Double): Double =
        java.lang.Double.longBitsToDouble(
            sp.getLong(key, java.lang.Double.doubleToRawLongBits(def))
        )
    private fun putDbl(key: String, v: Double) =
        sp.edit().putLong(key, java.lang.Double.doubleToRawLongBits(v)).apply()

    var theme: String
        get() = str("theme", "phulkari")
        set(v) = putStr("theme", v)
    var homeName: String
        get() = str("homeName", "Ottawa")
        set(v) = putStr("homeName", v)
    var homeLat: Double
        get() = dbl("homeLat", 45.4215)
        set(v) = putDbl("homeLat", v)
    var homeLon: Double
        get() = dbl("homeLon", -75.6972)
        set(v) = putDbl("homeLon", v)
    var secondName: String
        get() = str("secondName", "Amritsar")
        set(v) = putStr("secondName", v)
    var secondLat: Double
        get() = dbl("secondLat", 31.634)
        set(v) = putDbl("secondLat", v)
    var secondLon: Double
        get() = dbl("secondLon", 74.8723)
        set(v) = putDbl("secondLon", v)
    var secondTz: String
        get() = str("secondTz", "Asia/Kolkata")
        set(v) = putStr("secondTz", v)
    var autoSoundbar: Boolean
        get() = sp.getBoolean("autoSoundbar", true)
        set(v) = sp.edit().putBoolean("autoSoundbar", v).apply()
    var smartthingsToken: String
        get() = str("smartthingsToken", "")
        set(v) = putStr("smartthingsToken", v)
    var smartthingsDeviceId: String
        get() = str("smartthingsDeviceId", "")
        set(v) = putStr("smartthingsDeviceId", v)
    var bedtime: String
        get() = str("bedtime", "23:30")
        set(v) = putStr("bedtime", v)
    var units: String
        get() = str("units", "metric")
        set(v) = putStr("units", v)
    /** JSON array string of package names. Empty array = use the known apps. */
    var favorites: String
        get() = str("favorites", "[]")
        set(v) = putStr("favorites", v)
    /** JSON array string of package names hidden from the app list. */
    var hiddenApps: String
        get() = str("hiddenApps", "[]")
        set(v) = putStr("hiddenApps", v)
    /** Placeholder counter for the "ads blocked" tile. */
    var adsBlocked: Long
        get() = sp.getLong("adsBlocked", 0L)
        set(v) = sp.edit().putLong("adsBlocked", v).apply()
    /** True once we have asked for READ_TV_LISTINGS at first launch. */
    var askedTvListings: Boolean
        get() = sp.getBoolean("askedTvListings", false)
        set(v) = sp.edit().putBoolean("askedTvListings", v).apply()

    // --- Optional integrations (all free) ---
    /** Strava API app credentials + a refresh token (see SETUP.md, "Strava"). */
    var stravaClientId: String
        get() = str("stravaClientId", "")
        set(v) = putStr("stravaClientId", v)
    var stravaClientSecret: String
        get() = str("stravaClientSecret", "")
        set(v) = putStr("stravaClientSecret", v)
    var stravaRefreshToken: String
        get() = str("stravaRefreshToken", "")
        set(v) = putStr("stravaRefreshToken", v)
    /** TMDB v3 API key for Date Night picks. */
    var tmdbKey: String
        get() = str("tmdbKey", "")
        set(v) = putStr("tmdbKey", v)
    /** Two-letter country used for streaming availability (TMDB watch providers). */
    var region: String
        get() = str("region", "CA")
        set(v) = putStr("region", v)

    val stravaConfigured: Boolean
        get() = stravaClientId.isNotBlank() && stravaClientSecret.isNotBlank() && stravaRefreshToken.isNotBlank()
    val tmdbConfigured: Boolean
        get() = tmdbKey.isNotBlank()

    val smartthingsConfigured: Boolean
        get() = smartthingsToken.isNotBlank() && smartthingsDeviceId.isNotBlank()

    private fun parseArray(s: String): JSONArray =
        try { JSONArray(s) } catch (_: Exception) { JSONArray() }

    fun toJson(): JSONObject = JSONObject().apply {
        put("theme", theme)
        put("homeName", homeName)
        put("homeLat", homeLat)
        put("homeLon", homeLon)
        put("secondName", secondName)
        put("secondLat", secondLat)
        put("secondLon", secondLon)
        put("secondTz", secondTz)
        put("autoSoundbar", autoSoundbar)
        put("smartthingsConfigured", smartthingsConfigured)
        put("smartthingsTokenSet", smartthingsToken.isNotBlank())
        put("stravaConfigured", stravaConfigured)
        put("tmdbConfigured", tmdbConfigured)
        put("region", region)
        put("smartthingsDeviceId", smartthingsDeviceId)
        put("bedtime", bedtime)
        put("units", units)
        put("favorites", parseArray(favorites))
        put("hiddenApps", parseArray(hiddenApps))
    }

    fun favoritesList(): List<String> = parseArray(favorites).let { a ->
        (0 until a.length()).map { a.optString(it) }.filter { it.isNotEmpty() }
    }

    fun hiddenList(): List<String> = parseArray(hiddenApps).let { a ->
        (0 until a.length()).map { a.optString(it) }.filter { it.isNotEmpty() }
    }

    /** Merge a partial settings object. Returns true if the theme changed. */
    fun merge(o: JSONObject): Boolean {
        val oldTheme = theme
        if (o.has("theme")) o.optString("theme").takeIf { it.isNotBlank() }?.let { theme = it }
        if (o.has("homeName")) homeName = o.optString("homeName", homeName)
        if (o.has("homeLat")) homeLat = o.optDouble("homeLat", homeLat)
        if (o.has("homeLon")) homeLon = o.optDouble("homeLon", homeLon)
        if (o.has("secondName")) secondName = o.optString("secondName", secondName)
        if (o.has("secondLat")) secondLat = o.optDouble("secondLat", secondLat)
        if (o.has("secondLon")) secondLon = o.optDouble("secondLon", secondLon)
        if (o.has("secondTz")) secondTz = o.optString("secondTz", secondTz)
        if (o.has("autoSoundbar")) autoSoundbar = o.optBoolean("autoSoundbar", autoSoundbar)
        if (o.has("smartthingsToken")) smartthingsToken = o.optString("smartthingsToken", "").trim()
        if (o.has("smartthingsDeviceId")) smartthingsDeviceId = o.optString("smartthingsDeviceId", "").trim()
        if (o.has("stravaClientId")) stravaClientId = o.optString("stravaClientId", "").trim()
        if (o.has("stravaClientSecret")) stravaClientSecret = o.optString("stravaClientSecret", "").trim()
        if (o.has("stravaRefreshToken")) stravaRefreshToken = o.optString("stravaRefreshToken", "").trim()
        if (o.has("tmdbKey")) tmdbKey = o.optString("tmdbKey", "").trim()
        if (o.has("region")) region = o.optString("region", region).trim().uppercase()
        if (o.has("bedtime")) bedtime = o.optString("bedtime", bedtime)
        if (o.has("units")) units = o.optString("units", units)
        if (o.has("favorites")) favorites = arrayString(o.opt("favorites"), favorites)
        if (o.has("hiddenApps")) hiddenApps = arrayString(o.opt("hiddenApps"), hiddenApps)
        return theme != oldTheme
    }

    private fun arrayString(v: Any?, fallback: String): String = when (v) {
        is JSONArray -> v.toString()
        is String -> try { JSONArray(v).toString() } catch (_: Exception) { fallback }
        else -> fallback
    }
}
