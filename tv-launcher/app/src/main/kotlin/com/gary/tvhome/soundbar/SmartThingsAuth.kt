package com.gary.tvhome.soundbar

import android.util.Base64
import com.gary.tvhome.data.Prefs
import com.gary.tvhome.integrations.Http
import org.json.JSONObject

/**
 * Supplies a SmartThings access token.
 *  - OAuth (recommended): client id/secret from an API_ONLY SmartThings app plus a refresh token
 *    from a one-time browser sign-in (tools/smartthings-oauth.sh). Access tokens last ~24 h; we refresh
 *    a little early. Refresh tokens are SINGLE-USE and rotate, so each new one is saved immediately.
 *  - Personal access token: works, but SmartThings now expires new ones after 24 hours.
 */
class SmartThingsAuth(private val prefs: Prefs) {
    private val lock = Any()

    fun accessToken(): String = synchronized(lock) {
        if (!prefs.smartthingsOAuth) {
            check(prefs.smartthingsToken.isNotBlank()) { "SmartThings not set up" }
            return prefs.smartthingsToken
        }
        val now = System.currentTimeMillis()
        val cached = prefs.smartthingsAccessToken
        if (cached.isNotBlank() && now < prefs.smartthingsExpiresAt - 30 * 60_000L) return cached
        refresh()
    }

    /** Forces a refresh (also used by the daily keep-alive so the refresh token never lapses). */
    fun refresh(): String = synchronized(lock) {
        val basic = Base64.encodeToString(
            "${prefs.smartthingsClientId}:${prefs.smartthingsClientSecret}".toByteArray(), Base64.NO_WRAP
        )
        val body = Http.form(
            "grant_type" to "refresh_token",
            "client_id" to prefs.smartthingsClientId,
            "refresh_token" to prefs.smartthingsRefreshToken,
        )
        var lastError: Exception? = null
        for (url in TOKEN_URLS) {
            try {
                val res = JSONObject(
                    Http.request(url, "POST", mapOf("Authorization" to "Basic $basic"), body,
                        "application/x-www-form-urlencoded")
                )
                val access = res.getString("access_token")
                // Save the rotated refresh token first: the old one is already spent.
                res.optString("refresh_token").takeIf { it.isNotBlank() }?.let { prefs.smartthingsRefreshToken = it }
                prefs.smartthingsAccessToken = access
                prefs.smartthingsExpiresAt = System.currentTimeMillis() + res.optLong("expires_in", 86_399L) * 1000L
                return access
            } catch (e: Exception) {
                lastError = e
                if (e.message?.contains("HTTP 404") != true) break // only fall through to the next URL on 404
            }
        }
        throw IllegalStateException("SmartThings sign-in expired or failed: ${lastError?.message}. Re-run tools/smartthings-oauth.sh")
    }

    companion object {
        // Community-verified host first, then the path the official docs list.
        val TOKEN_URLS = listOf("https://api.smartthings.com/oauth/token", "https://api.smartthings.com/v1/oauth/token")
    }
}
