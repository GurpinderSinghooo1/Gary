package com.gary.tvhome.data

import android.content.Context
import android.database.Cursor
import android.util.Log
import androidx.tvprovider.media.tv.TvContractCompat
import androidx.tvprovider.media.tv.WatchNextProgram
import com.gary.tvhome.web.LocalPathHandlers
import org.json.JSONArray
import org.json.JSONObject

/**
 * Reads the Android TV "Watch Next" provider (continue watching).
 * Needs the READ_TV_LISTINGS permission: grant via
 *   adb shell pm grant com.gary.tvhome android.permission.READ_TV_LISTINGS
 */
class WatchNextRepository(context: Context) {
    private val resolver = context.applicationContext.contentResolver

    fun query(): JSONObject {
        val items = ArrayList<JSONObject>()
        var permission = true
        try {
            val cursor: Cursor? = resolver.query(
                TvContractCompat.WatchNextPrograms.CONTENT_URI,
                WatchNextProgram.PROJECTION,
                null, null, null
            )
            cursor?.use { c ->
                while (c.moveToNext()) {
                    try {
                        items.add(map(c))
                    } catch (e: Exception) {
                        Log.w(TAG, "row skipped: ${e.message}")
                    }
                }
            }
        } catch (e: IllegalArgumentException) {
            permission = false
        } catch (e: SecurityException) {
            permission = false
        }
        items.sortByDescending { it.optLong("lastEngagementMs") }
        val arr = JSONArray()
        items.take(20).forEach { arr.put(it) }
        return JSONObject().put("items", arr).put("permission", permission)
    }

    private fun map(c: Cursor): JSONObject {
        val p = WatchNextProgram.fromCursor(c)
        val pkgIdx = c.getColumnIndex("package_name")
        val pkg = if (pkgIdx >= 0) c.getString(pkgIdx) else null
        val duration = p.durationMillis
        val position = p.lastPlaybackPositionMillis
        val progress = if (duration > 0 && position >= 0) {
            (position.toLong() * 100L / duration.toLong()).toInt().coerceIn(0, 100)
        } else 0
        val poster = p.posterArtUri?.let { uri ->
            when (uri.scheme?.lowercase()) {
                "http", "https" -> uri.toString()
                "content", "android.resource" -> LocalPathHandlers.artUrl(uri.toString())
                else -> null
            }
        }
        return JSONObject().apply {
            put("title", p.title ?: JSONObject.NULL)
            put("episodeTitle", p.episodeTitle ?: JSONObject.NULL)
            put("season", p.seasonNumber?.toString() ?: JSONObject.NULL)
            put("episode", p.episodeNumber?.toString() ?: JSONObject.NULL)
            put("packageName", pkg ?: JSONObject.NULL)
            put("progress", progress)
            put("durationMs", duration)
            put("positionMs", position)
            put("posterUrl", poster ?: JSONObject.NULL)
            put("intentUri", p.intentUri?.toString() ?: JSONObject.NULL)
            put("lastEngagementMs", p.lastEngagementTimeUtcMillis)
            put("watchNextType", p.watchNextType)
        }
    }

    private companion object {
        const val TAG = "WatchNextRepository"
    }
}
