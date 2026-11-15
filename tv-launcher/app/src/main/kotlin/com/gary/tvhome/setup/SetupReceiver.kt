package com.gary.tvhome.setup

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Base64
import android.util.Log
import com.gary.tvhome.HomeActivity
import com.gary.tvhome.TvHomeApp
import org.json.JSONObject

/**
 * Lets a computer push settings to the TV over adb, so nobody has to type API keys with a remote.
 * Protected by android.permission.DUMP in the manifest: only the adb shell (and the system) can send it.
 *
 *   adb shell am broadcast -a com.gary.tvhome.SETUP -n com.gary.tvhome/.setup.SetupReceiver --es b64 <base64 json>
 *
 * JSON shape: { "settings": { ...Prefs keys... }, "store": { "callus.goals": [...], ... } }
 * tools/push-config.sh builds and sends this from config.json.
 */
class SetupReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION) return
        val app = context.applicationContext as? TvHomeApp ?: return
        try {
            val raw = intent.getStringExtra("b64")?.let { String(Base64.decode(it, Base64.DEFAULT), Charsets.UTF_8) }
                ?: intent.getStringExtra("json") ?: return
            val root = JSONObject(raw)
            root.optJSONObject("settings")?.let { app.prefs.merge(it) }
            root.optJSONObject("store")?.let { store ->
                val keys = store.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    app.store.set(k, store.opt(k))
                }
            }
            resultData = "ok"
            Log.i(TAG, "Applied setup: settings=${root.has("settings")} store=${root.optJSONObject("store")?.length() ?: 0}")
            HomeActivity.current()?.reloadTheme()
        } catch (e: Exception) {
            resultData = "error: ${e.message}"
            Log.w(TAG, "Setup failed", e)
        }
    }

    companion object {
        const val ACTION = "com.gary.tvhome.SETUP"
        private const val TAG = "SetupReceiver"
    }
}
