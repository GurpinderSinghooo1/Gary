package com.gary.tvhome.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

/**
 * Small key -> JSON store for theme content the user types in once:
 * sticky-note goals and cookie-jar wins (Callus), race name/date (Pace),
 * anniversary date (Date Night), followed shows (Sora), etc.
 * Values are any JSON value (object, array, string, number, boolean).
 */
class Store(context: Context) {
    private val sp = context.applicationContext.getSharedPreferences("tvhome_store", Context.MODE_PRIVATE)

    fun get(key: String): Any? {
        val raw = sp.getString(key, null) ?: return null
        return try {
            JSONTokener(raw).nextValue()
        } catch (_: Exception) {
            raw
        }
    }

    fun set(key: String, value: Any?) {
        require(KEY_RE.matches(key)) { "Bad key" }
        val e = sp.edit()
        when (value) {
            null, JSONObject.NULL -> e.remove(key)
            is JSONObject, is JSONArray -> e.putString(key, value.toString())
            is String -> e.putString(key, JSONObject.quote(value))
            else -> e.putString(key, value.toString())
        }
        e.apply()
    }

    fun all(): JSONObject {
        val out = JSONObject()
        for (k in sp.all.keys) out.put(k, get(k) ?: JSONObject.NULL)
        return out
    }

    private companion object {
        val KEY_RE = Regex("[A-Za-z0-9_.-]{1,64}")
    }
}
