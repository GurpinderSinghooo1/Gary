package com.gary.tvhome.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.os.SystemClock
import org.json.JSONObject
import java.util.TimeZone

/** Wifi / storage / device / uptime info. SSID may be hidden without location permission. */
class SystemInfo(context: Context, private val prefs: Prefs) {
    private val ctx = context.applicationContext

    @Suppress("DEPRECATION")
    fun get(): JSONObject {
        val wifi = JSONObject()
        try {
            val wm = ctx.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val info = wm?.connectionInfo
            val rssi = info?.rssi ?: -127
            val connected = info != null && info.networkId != -1 && rssi > -127
            var ssid = info?.ssid?.trim('"') ?: ""
            if (ssid == "<unknown ssid>") ssid = ""
            wifi.put("connected", connected)
            wifi.put("ssid", ssid)
            wifi.put("rssi", rssi)
            wifi.put("linkSpeedMbps", info?.linkSpeed ?: 0)
            wifi.put("signalLevel", if (connected) WifiManager.calculateSignalLevel(rssi, 5) else 0)
        } catch (_: Exception) {
            wifi.put("connected", false)
        }
        var ethernet = false
        try {
            val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val caps = cm?.activeNetwork?.let { cm.getNetworkCapabilities(it) }
            ethernet = caps?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true
        } catch (_: Exception) {
        }
        wifi.put("ethernet", ethernet)

        val storage = JSONObject()
        try {
            val st = StatFs(Environment.getDataDirectory().path)
            storage.put("freeBytes", st.availableBytes)
            storage.put("totalBytes", st.totalBytes)
        } catch (_: Exception) {
            storage.put("freeBytes", 0).put("totalBytes", 0)
        }

        val device = JSONObject()
            .put("model", Build.MODEL ?: "")
            .put("manufacturer", Build.MANUFACTURER ?: "")
            .put("android", Build.VERSION.RELEASE ?: "")
            .put("sdk", Build.VERSION.SDK_INT)

        return JSONObject()
            .put("wifi", wifi)
            .put("storage", storage)
            .put("device", device)
            .put("uptimeMs", SystemClock.elapsedRealtime())
            .put("adsBlocked", prefs.adsBlocked)
            .put("timeZone", TimeZone.getDefault().id)
    }
}
