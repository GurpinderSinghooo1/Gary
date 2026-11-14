package com.gary.tvhome.data

import android.app.AppOpsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Screen-time stats from UsageStatsManager.
 * Needs usage access, granted via:
 *   adb shell appops set com.gary.tvhome GET_USAGE_STATS allow
 * Note: Android only keeps ~7-10 days of daily buckets, so the streak is capped by that;
 * yearMs uses the yearly bucket (best effort).
 */
class StatsRepository(context: Context) {
    private val ctx = context.applicationContext

    @Suppress("DEPRECATION")
    fun hasAccess(): Boolean = try {
        val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        mode == AppOpsManager.MODE_ALLOWED
    } catch (_: Exception) {
        false
    }

    private fun dayStart(daysAgo: Int): Long {
        val c = Calendar.getInstance()
        c.set(Calendar.HOUR_OF_DAY, 0)
        c.set(Calendar.MINUTE, 0)
        c.set(Calendar.SECOND, 0)
        c.set(Calendar.MILLISECOND, 0)
        c.add(Calendar.DAY_OF_YEAR, -daysAgo)
        return c.timeInMillis
    }

    private fun yearStart(): Long {
        val c = Calendar.getInstance()
        c.set(Calendar.MONTH, Calendar.JANUARY)
        c.set(Calendar.DAY_OF_MONTH, 1)
        c.set(Calendar.HOUR_OF_DAY, 0)
        c.set(Calendar.MINUTE, 0)
        c.set(Calendar.SECOND, 0)
        c.set(Calendar.MILLISECOND, 0)
        return c.timeInMillis
    }

    /** package -> foreground ms within [start, end) using the given interval type. */
    private fun perPackage(mgr: UsageStatsManager, interval: Int, start: Long, end: Long): Map<String, Long> {
        val list: List<UsageStats> = try {
            mgr.queryUsageStats(interval, start, end) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
        val out = HashMap<String, Long>()
        for (s in list) {
            if (s.lastTimeStamp <= start || s.firstTimeStamp >= end) continue
            out[s.packageName] = (out[s.packageName] ?: 0L) + s.totalTimeInForeground
        }
        return out
    }

    fun get(): JSONObject {
        if (!hasAccess()) return JSONObject().put("granted", false)
        val mgr = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return JSONObject().put("granted", false)
        val known = AppRepository.KNOWN_PACKAGES
        val now = System.currentTimeMillis()

        val days = 14
        val streaming = LongArray(days)
        val all = LongArray(days)
        for (i in 0 until days) {
            val start = dayStart(i)
            val end = if (i == 0) now else dayStart(i - 1)
            val m = perPackage(mgr, UsageStatsManager.INTERVAL_DAILY, start, end)
            all[i] = m.values.sum()
            streaming[i] = m.filterKeys { it in known }.values.sum()
        }

        val year = perPackage(mgr, UsageStatsManager.INTERVAL_YEARLY, yearStart(), now)
        val perApp = JSONObject()
        val perAppId = JSONObject()
        var topPkg: String? = null
        var topMs = 0L
        for (k in AppRepository.KNOWN) {
            var idTotal = 0L
            for (p in k.packages) {
                val ms = year[p] ?: 0L
                if (ms > 0) perApp.put(p, ms)
                idTotal += ms
            }
            perAppId.put(k.id, idTotal)
            if (idTotal > topMs) {
                topMs = idTotal
                topPkg = k.id
            }
        }

        val threshold = 15 * 60 * 1000L
        var streak = if (streaming[0] >= threshold) 1 else 0
        for (i in 1 until days) {
            if (streaming[i] >= threshold) streak++ else break
        }

        val last7 = JSONArray()
        for (i in 6 downTo 0) last7.put(streaming[i])

        return JSONObject().apply {
            put("granted", true)
            put("todayMs", streaming[0])
            put("weekMs", (0 until 7).sumOf { streaming[it] })
            put("yearMs", known.sumOf { year[it] ?: 0L })
            put("all", JSONObject()
                .put("todayMs", all[0])
                .put("weekMs", (0 until 7).sumOf { all[it] })
                .put("yearMs", year.values.sum()))
            put("perApp", perApp)
            put("perAppId", perAppId)
            put("last7Days", last7)
            put("streakDays", streak)
            put("topApp", topPkg ?: JSONObject.NULL)
        }
    }
}
