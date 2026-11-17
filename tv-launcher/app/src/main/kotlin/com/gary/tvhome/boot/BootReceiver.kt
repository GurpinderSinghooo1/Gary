package com.gary.tvhome.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.gary.tvhome.TvHomeApp
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/** On BOOT_COMPLETED, make sure the soundbar is on (if SmartThings is configured). */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val app = context.applicationContext as? TvHomeApp ?: return
        val pending = goAsync()
        app.appScope.launch {
            try {
                withTimeoutOrNull(8_000L) { app.soundbarManager.ensureOnNow("boot") }
            } catch (_: Exception) {
            } finally {
                pending.finish()
            }
        }
    }
}
