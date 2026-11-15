package com.gary.tvhome.access

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import com.gary.tvhome.HomeActivity

/**
 * Makes HOME on the remote open TV Home on Google TV builds that ignore the default-home setting
 * (Hisense and others). The same approach Projectivy and Button Mapper use.
 *
 *  1. onKeyEvent: the HOME key is caught before the system handles it and opens TV Home instead.
 *  2. Fallback: if Google's home screen still comes to the front (boot, an app closing to it),
 *     TV Home is brought straight back over it.
 *
 * Google's home screen stays installed and enabled underneath; disabling it makes Setup Wizard
 * take over HOME and loop. Turn this off with tools/home-button.sh off (or Settings → Accessibility).
 */
class HomeButtonService : AccessibilityService() {
    private var lastLaunch = 0L

    override fun onKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode != KeyEvent.KEYCODE_HOME) return false
        Log.i(TAG, "HOME key caught (action=${event.action})")
        if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) openHome()
        return true // swallow both DOWN and UP so the system never sees HOME
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg in STOCK_HOMES) { Log.i(TAG, "stock home in front ($pkg), bringing TV Home back"); openHome() }
    }

    override fun onInterrupt() {}

    private fun openHome() {
        val now = SystemClock.elapsedRealtime()
        if (now - lastLaunch < 700) return
        lastLaunch = now
        try {
            startActivity(
                Intent(this, HomeActivity::class.java).addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                )
            )
        } catch (_: Exception) {
            // Never let a launch failure take HOME away: fall back to the system home.
            lastLaunch = 0L
            performGlobalAction(GLOBAL_ACTION_HOME)
        }
    }

    override fun onServiceConnected() { Log.i(TAG, "connected") }

    companion object {
        private const val TAG = "HomeButtonService"
        val STOCK_HOMES = setOf(
            "com.google.android.apps.tv.launcherx",
            "com.google.android.tvlauncher",
            "com.google.android.leanbacklauncher"
        )
    }
}
