package com.gary.tvhome.soundbar

import android.util.Log
import com.gary.tvhome.HomeActivity
import com.gary.tvhome.data.Prefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * Soundbar control through SmartThings (token + device id set in settings).
 * Without SmartThings configured, power is left to HDMI-CEC and status says so.
 */
class SoundbarManager(private val prefs: Prefs, private val scope: CoroutineScope) {
    @Volatile private var lastEnsure = 0L
    private val auth = SmartThingsAuth(prefs)

    /** Keeps the OAuth refresh token alive (they expire if unused for a long time). Call daily. */
    fun keepAlive() {
        if (!prefs.smartthingsOAuth) return
        scope.launch(Dispatchers.IO) {
            try { auth.accessToken() } catch (e: Exception) { Log.w(TAG, "keepAlive: ${e.message}") }
        }
    }

    private fun client(): SmartThingsClient? =
        if (prefs.smartthingsConfigured) SmartThingsClient({ auth.accessToken() }, prefs.smartthingsDeviceId) else null

    private fun requireClient(): SmartThingsClient =
        client() ?: throw IllegalStateException("Soundbar not configured (set SmartThings token and device)")

    suspend fun status(): JSONObject = withContext(Dispatchers.IO) {
        val c = client() ?: return@withContext JSONObject()
            .put("configured", false)
            .put("method", "cec")
            .put("note", "Power is handled by HDMI-CEC. Set up SmartThings for full control.")
        val main = c.status().optJSONObject("components")?.optJSONObject("main")
        val out = JSONObject().put("configured", true).put("method", "smartthings")
        val sw = main?.optJSONObject("switch")?.optJSONObject("switch")?.optString("value", "")
        if (!sw.isNullOrEmpty()) out.put("power", sw == "on")
        main?.optJSONObject("audioVolume")?.optJSONObject("volume")?.let {
            if (it.has("value") && !it.isNull("value")) out.put("volume", it.optInt("value"))
        }
        main?.optJSONObject("audioMute")?.optJSONObject("mute")?.optString("value", "")?.let {
            if (it.isNotEmpty()) out.put("mute", it == "muted")
        }
        out
    }

    suspend fun power(on: Boolean): JSONObject = withContext(Dispatchers.IO) {
        requireClient().command("switch", if (on) "on" else "off")
        JSONObject().put("power", on)
    }

    suspend fun volume(level: Int): JSONObject = withContext(Dispatchers.IO) {
        val l = level.coerceIn(0, 100)
        requireClient().command("audioVolume", "setVolume", JSONArray().put(l))
        JSONObject().put("volume", l)
    }

    suspend fun mute(mute: Boolean): JSONObject = withContext(Dispatchers.IO) {
        requireClient().command("audioMute", if (mute) "mute" else "unmute")
        JSONObject().put("mute", mute)
    }

    /**
     * EXPERIMENTAL: sound mode via the Samsung "execute" capability. Only some models
     * (Q-series / S-series soundbars) accept this; others return an error.
     */
    suspend fun mode(mode: String): JSONObject = withContext(Dispatchers.IO) {
        val args = JSONArray()
            .put("/sec/networkaudio/soundmode")
            .put(JSONObject().put("x.com.samsung.networkaudio.soundmode", mode))
        requireClient().command("execute", "execute", args)
        JSONObject().put("mode", mode)
    }

    /** Only the token is needed here, so the settings page can list devices before one is picked. */
    private fun tokenClient(): SmartThingsClient {
        check(prefs.smartthingsAuthSet) { "SmartThings not set up" }
        return SmartThingsClient({ auth.accessToken() }, prefs.smartthingsDeviceId)
    }

    suspend fun devices(): JSONArray = withContext(Dispatchers.IO) { tokenClient().listDevices() }

    suspend fun scenes(): JSONArray = withContext(Dispatchers.IO) { tokenClient().listScenes() }

    suspend fun runScene(id: String): Boolean = withContext(Dispatchers.IO) { tokenClient().runScene(id); true }

    /**
     * Fire-and-forget ensureOn, debounced to once per 30 s. When the TV wakes, Wi-Fi often needs a
     * few seconds to reconnect, so failed attempts are retried after 4, 12 and 30 seconds.
     */
    fun ensureOn(reason: String) {
        if (!prefs.smartthingsConfigured) return
        val now = System.currentTimeMillis()
        if (now - lastEnsure < 30_000L) return
        lastEnsure = now
        scope.launch(Dispatchers.IO) {
            for (wait in longArrayOf(0L, 4_000L, 12_000L, 30_000L)) {
                if (wait > 0) kotlinx.coroutines.delay(wait)
                try {
                    attempt(reason)
                    return@launch
                } catch (e: Exception) {
                    Log.w(TAG, "ensureOn($reason) attempt failed: ${e.message}")
                }
            }
        }
    }

    /** One status check + power-on. Throws on network/API errors so the caller can retry. */
    private suspend fun attempt(reason: String): Boolean {
        val c = client() ?: return false
        val sw = c.status().optJSONObject("components")?.optJSONObject("main")
            ?.optJSONObject("switch")?.optJSONObject("switch")?.optString("value", "")
        var sent = false
        if (sw == "off") {
            c.command("switch", "on")
            sent = true
        }
        Log.i(TAG, "ensureOn($reason): switch=$sw sent=$sent")
        HomeActivity.current()?.emit("soundbar", status().toString())
        return sent
    }

    /** Suspending variant (used by BootReceiver). Returns true if a power-on was sent. */
    suspend fun ensureOnNow(reason: String): Boolean = withContext(Dispatchers.IO) {
        val c = client() ?: return@withContext false
        val now = System.currentTimeMillis()
        if (now - lastEnsure < 30_000L) return@withContext false
        lastEnsure = now
        var sent = false
        try {
            val sw = c.status().optJSONObject("components")?.optJSONObject("main")
                ?.optJSONObject("switch")?.optJSONObject("switch")?.optString("value", "")
            if (sw == "off") {
                c.command("switch", "on")
                sent = true
            }
            Log.i(TAG, "ensureOn($reason): switch=$sw sent=$sent")
            HomeActivity.current()?.emit("soundbar", status().toString())
        } catch (e: Exception) {
            Log.w(TAG, "ensureOn($reason) error: ${e.message}")
        }
        sent
    }

    private companion object {
        const val TAG = "SoundbarManager"
    }
}
