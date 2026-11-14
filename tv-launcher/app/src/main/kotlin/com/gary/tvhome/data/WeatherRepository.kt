package com.gary.tvhome.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/** Open-Meteo weather client (no API key) with a 20 minute in-memory cache per location. */
class WeatherRepository(private val prefs: Prefs) {
    private class Entry(val at: Long, val data: JSONObject)

    private val cache = ConcurrentHashMap<String, Entry>()

    suspend fun get(name: String?, lat: Double, lon: Double): JSONObject = withContext(Dispatchers.IO) {
        val imperial = prefs.units == "imperial"
        val key = String.format(java.util.Locale.US, "%.3f,%.3f,%s", lat, lon, if (imperial) "i" else "m")
        val now = System.currentTimeMillis()
        val hit = cache[key]
        val raw: JSONObject = if (hit != null && now - hit.at < CACHE_MS) {
            hit.data
        } else {
            val fresh = fetch(lat, lon, imperial)
            cache[key] = Entry(now, fresh)
            fresh
        }
        // Return a copy with the requested display name.
        JSONObject(raw.toString()).put("name", name ?: "")
    }

    suspend fun getHome(): JSONObject = get(prefs.homeName, prefs.homeLat, prefs.homeLon)

    suspend fun getMulti(places: JSONArray): JSONArray = withContext(Dispatchers.IO) {
        val out = JSONArray()
        for (i in 0 until places.length()) {
            val p = places.optJSONObject(i) ?: continue
            val name = p.optString("name", "")
            try {
                out.put(get(name, p.getDouble("lat"), p.getDouble("lon")))
            } catch (e: Exception) {
                out.put(JSONObject().put("name", name).put("error", e.message ?: "failed"))
            }
        }
        out
    }

    private fun fetch(lat: Double, lon: Double, imperial: Boolean): JSONObject {
        val loc = java.util.Locale.US
        var url = "https://api.open-meteo.com/v1/forecast" +
            "?latitude=" + String.format(loc, "%.4f", lat) +
            "&longitude=" + String.format(loc, "%.4f", lon) +
            "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,is_day" +
            "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max" +
            "&timezone=auto&forecast_days=5"
        if (imperial) url += "&temperature_unit=fahrenheit"
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            conn.requestMethod = "GET"
            val code = conn.responseCode
            if (code !in 200..299) throw IllegalStateException("Weather HTTP $code")
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            return convert(JSONObject(body))
        } finally {
            conn.disconnect()
        }
    }

    private fun num(a: JSONArray?, i: Int): Any {
        if (a == null || a.isNull(i)) return JSONObject.NULL
        val d = a.optDouble(i)
        return if (d.isNaN()) JSONObject.NULL else d
    }

    private fun dv(o: JSONObject, key: String): Any {
        val d = o.optDouble(key)
        return if (d.isNaN()) JSONObject.NULL else d
    }

    private fun str(a: JSONArray?, i: Int): Any =
        if (a == null || a.isNull(i)) JSONObject.NULL else a.optString(i)

    private fun convert(src: JSONObject): JSONObject {
        val cur = src.optJSONObject("current") ?: JSONObject()
        val code = cur.optInt("weather_code", 0)
        val current = JSONObject().apply {
            put("temp", dv(cur, "temperature_2m"))
            put("feelsLike", dv(cur, "apparent_temperature"))
            put("code", code)
            put("text", codeToText(code))
            put("windKmh", dv(cur, "wind_speed_10m"))
            put("windDir", dv(cur, "wind_direction_10m"))
            put("cloud", dv(cur, "cloud_cover"))
            put("isDay", cur.optInt("is_day", 1) == 1)
        }
        val d = src.optJSONObject("daily") ?: JSONObject()
        val times = d.optJSONArray("time") ?: JSONArray()
        val codes = d.optJSONArray("weather_code")
        val maxs = d.optJSONArray("temperature_2m_max")
        val mins = d.optJSONArray("temperature_2m_min")
        val rises = d.optJSONArray("sunrise")
        val sets = d.optJSONArray("sunset")
        val rain = d.optJSONArray("precipitation_probability_max")
        val daily = JSONArray()
        for (i in 0 until times.length()) {
            val c = codes?.optInt(i, 0) ?: 0
            daily.put(JSONObject().apply {
                put("date", times.optString(i))
                put("code", c)
                put("text", codeToText(c))
                put("max", num(maxs, i))
                put("min", num(mins, i))
                put("sunrise", str(rises, i))
                put("sunset", str(sets, i))
                put("rainChance", num(rain, i))
            })
        }
        return JSONObject().put("name", "").put("current", current).put("daily", daily)
    }

    companion object {
        private const val CACHE_MS = 20 * 60 * 1000L

        /** Map a WMO weather code to short English text. */
        fun codeToText(code: Int): String = when (code) {
            0 -> "Clear"
            1 -> "Mainly clear"
            2 -> "Partly cloudy"
            3 -> "Cloudy"
            45, 48 -> "Fog"
            in 51..57 -> "Drizzle"
            in 61..67 -> "Rain"
            in 71..77 -> "Snow"
            in 80..82 -> "Showers"
            85, 86 -> "Snow showers"
            in 95..99 -> "Thunderstorm"
            else -> "Unknown"
        }
    }
}
