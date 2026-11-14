package com.gary.tvhome.integrations

import com.gary.tvhome.data.Prefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

/**
 * Strava (free API) for the training themes: Pace, Callus, Engine.
 * Setup: create an API app at strava.com/settings/api, authorise once with scope
 * activity:read_all, and paste client id, client secret and the refresh token into the
 * TV's settings page (SETUP.md walks through it). The refresh token rotates; we store the new one.
 *
 * summary() returns:
 *  { today:{minutes}, week:{runKm, runs, minutes, startDate},
 *    weeks:[{start, km, minutes}] (6, oldest first),
 *    lastRun:{name, date, km, movingS, paceSPerKm, splits:[sec per km]} | null,
 *    streakDays, fetchedAt }
 */
class StravaClient(private val prefs: Prefs) {
    @Volatile private var accessToken: String = ""
    @Volatile private var expiresAt: Long = 0L
    @Volatile private var cache: JSONObject? = null
    @Volatile private var cacheAt: Long = 0L

    private fun token(): String {
        val now = System.currentTimeMillis() / 1000
        if (accessToken.isNotEmpty() && now < expiresAt - 120) return accessToken
        val body = Http.form(
            "client_id" to prefs.stravaClientId,
            "client_secret" to prefs.stravaClientSecret,
            "grant_type" to "refresh_token",
            "refresh_token" to prefs.stravaRefreshToken,
        )
        val res = JSONObject(
            Http.request(
                "https://www.strava.com/oauth/token", "POST", body = body,
                contentType = "application/x-www-form-urlencoded"
            )
        )
        accessToken = res.getString("access_token")
        expiresAt = res.optLong("expires_at", now + 3600)
        res.optString("refresh_token").takeIf { it.isNotBlank() && it != prefs.stravaRefreshToken }
            ?.let { prefs.stravaRefreshToken = it }
        return accessToken
    }

    private fun api(path: String): String =
        Http.request("https://www.strava.com/api/v3$path", headers = mapOf("Authorization" to "Bearer ${token()}"))

    suspend fun summary(force: Boolean = false): JSONObject = withContext(Dispatchers.IO) {
        if (!prefs.stravaConfigured) return@withContext JSONObject().put("configured", false)
        val c = cache
        if (!force && c != null && System.currentTimeMillis() - cacheAt < 10 * 60_000L) return@withContext c

        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        val from = weekStart.minusWeeks(5)
        val after = from.atStartOfDay(zone).toEpochSecond()
        val acts = JSONArray(api("/athlete/activities?after=$after&per_page=200"))

        var todayMin = 0.0
        var weekRunKm = 0.0
        var weekRuns = 0
        var weekMin = 0.0
        val weekKm = DoubleArray(6)
        val weekMins = DoubleArray(6)
        val activeDays = HashSet<LocalDate>()
        var lastRun: JSONObject? = null
        var lastRunDate: LocalDateTime? = null

        for (i in 0 until acts.length()) {
            val a = acts.optJSONObject(i) ?: continue
            val start = parseLocal(a.optString("start_date_local")) ?: continue
            val day = start.toLocalDate()
            val km = a.optDouble("distance", 0.0) / 1000.0
            val min = a.optDouble("moving_time", 0.0) / 60.0
            val sport = a.optString("sport_type", a.optString("type"))
            val isRun = sport.contains("Run", ignoreCase = true)
            activeDays.add(day)
            if (day == today) todayMin += min
            val wIdx = 5 - ChronoUnit.WEEKS.between(day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)), weekStart).toInt()
            if (wIdx in 0..5) {
                weekMins[wIdx] += min
                if (isRun) weekKm[wIdx] += km
            }
            if (!day.isBefore(weekStart)) {
                weekMin += min
                if (isRun) { weekRunKm += km; weekRuns++ }
            }
            if (isRun && (lastRunDate == null || start.isAfter(lastRunDate))) {
                lastRunDate = start
                lastRun = a
            }
        }

        var streak = 0
        var d = if (activeDays.contains(today)) today else today.minusDays(1)
        while (activeDays.contains(d)) { streak++; d = d.minusDays(1) }

        val out = JSONObject()
            .put("configured", true)
            .put("today", JSONObject().put("minutes", Math.round(todayMin)))
            .put("week", JSONObject().put("runKm", round1(weekRunKm)).put("runs", weekRuns)
                .put("minutes", Math.round(weekMin)).put("startDate", weekStart.toString()))
            .put("weeks", JSONArray().also { arr ->
                for (w in 0..5) arr.put(JSONObject().put("start", weekStart.minusWeeks((5 - w).toLong()).toString())
                    .put("km", round1(weekKm[w])).put("minutes", Math.round(weekMins[w])))
            })
            .put("streakDays", streak)
            .put("fetchedAt", System.currentTimeMillis())

        val lr = lastRun
        if (lr != null) {
            val km = lr.optDouble("distance", 0.0) / 1000.0
            val moving = lr.optInt("moving_time", 0)
            val splits = JSONArray()
            try {
                val detail = JSONObject(api("/activities/${lr.optLong("id")}"))
                val sm = detail.optJSONArray("splits_metric") ?: JSONArray()
                for (i in 0 until sm.length()) {
                    val s = sm.optJSONObject(i) ?: continue
                    val dist = s.optDouble("distance", 0.0)
                    if (dist < 500) continue // skip the short final split
                    splits.put(Math.round(s.optDouble("moving_time", 0.0) * 1000.0 / dist))
                }
            } catch (_: Exception) {
                // splits are a nice-to-have
            }
            out.put("lastRun", JSONObject()
                .put("name", lr.optString("name"))
                .put("date", lr.optString("start_date_local"))
                .put("km", round1(km))
                .put("movingS", moving)
                .put("paceSPerKm", if (km > 0) Math.round(moving / km) else 0)
                .put("splits", splits))
        } else out.put("lastRun", JSONObject.NULL)

        cache = out
        cacheAt = System.currentTimeMillis()
        out
    }

    private fun parseLocal(s: String): LocalDateTime? = try {
        LocalDateTime.parse(s.removeSuffix("Z"))
    } catch (_: Exception) {
        null
    }

    private fun round1(v: Double) = Math.round(v * 10.0) / 10.0
}
