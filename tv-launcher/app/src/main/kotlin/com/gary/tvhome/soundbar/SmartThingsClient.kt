package com.gary.tvhome.soundbar

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Minimal blocking SmartThings REST client. Call only from a background thread.
 * Needs a SmartThings personal access token (devices read/execute scope) set in settings.
 */
class SmartThingsClient(private val tokenProvider: () -> String, private val deviceId: String) {

    private fun call(method: String, path: String, body: String? = null): String {
        val conn = URL(BASE + path).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            conn.requestMethod = method
            conn.setRequestProperty("Authorization", "Bearer ${tokenProvider()}")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Accept", "application/json")
            if (body != null) {
                conn.doOutput = true
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) throw IllegalStateException("SmartThings HTTP $code")
            return text
        } finally {
            conn.disconnect()
        }
    }

    /** Raw device status JSON. */
    fun status(): JSONObject = JSONObject(call("GET", "/devices/$deviceId/status"))

    fun command(capability: String, command: String, arguments: JSONArray? = null) {
        val cmd = JSONObject()
            .put("component", "main")
            .put("capability", capability)
            .put("command", command)
        if (arguments != null) cmd.put("arguments", arguments)
        val body = JSONObject().put("commands", JSONArray().put(cmd)).toString()
        call("POST", "/devices/$deviceId/commands", body)
    }

    /** All devices visible to the token: [{deviceId,label,name}]. */
    fun listDevices(): JSONArray {
        val root = JSONObject(call("GET", "/devices"))
        val items = root.optJSONArray("items") ?: JSONArray()
        val out = JSONArray()
        for (i in 0 until items.length()) {
            val d = items.optJSONObject(i) ?: continue
            out.put(
                JSONObject()
                    .put("deviceId", d.optString("deviceId"))
                    .put("label", d.optString("label"))
                    .put("name", d.optString("name"))
            )
        }
        return out
    }

    /** Scenes in the user's locations: [{sceneId,name}] (e.g. "Movie night" that dims lights). */
    fun listScenes(): JSONArray {
        val root = JSONObject(call("GET", "/scenes"))
        val items = root.optJSONArray("items") ?: JSONArray()
        val out = JSONArray()
        for (i in 0 until items.length()) {
            val s = items.optJSONObject(i) ?: continue
            out.put(JSONObject().put("sceneId", s.optString("sceneId")).put("name", s.optString("sceneName")))
        }
        return out
    }

    fun runScene(sceneId: String) {
        require(sceneId.matches(Regex("[A-Za-z0-9-]{1,64}"))) { "Bad scene id" }
        call("POST", "/scenes/$sceneId/execute", "{}")
    }

    companion object {
        private const val BASE = "https://api.smartthings.com/v1"
    }
}
