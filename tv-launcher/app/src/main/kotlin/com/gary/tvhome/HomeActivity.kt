package com.gary.tvhome

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import com.gary.tvhome.web.LocalPathHandlers
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * Fullscreen immersive Activity hosting the WebView that renders the HTML theme.
 * Native -> JS events go through emit(); JS -> native goes through the TvBridge object.
 * READ_TV_LISTINGS is requested on first launch (or grant by adb:
 *   adb shell pm grant com.gary.tvhome android.permission.READ_TV_LISTINGS).
 */
class HomeActivity : Activity() {
    private var webView: WebView? = null
    private lateinit var loader: WebViewAssetLoader
    private var bridge: TvBridge? = null
    val app: TvHomeApp get() = application as TvHomeApp

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        loader = LocalPathHandlers(this).createLoader()

        val wv = WebView(this)
        webView = wv
        wv.setBackgroundColor(Color.BLACK)
        wv.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        wv.isFocusable = true
        wv.isFocusableInTouchMode = true
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                request.url.host != LocalPathHandlers.DOMAIN

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // Recreate the activity (and WebView) instead of crashing the app.
                view.post { recreate() }
                return true
            }
        }
        val b = TvBridge(this)
        bridge = b
        wv.addJavascriptInterface(b, "TvBridge")
        setContentView(wv)
        wv.requestFocus()
        wv.loadUrl(homeUrl())

        requestListingsPermissionOnce()
    }

    private fun homeUrl(): String =
        "https://${LocalPathHandlers.DOMAIN}/assets/web/home.html?theme=" + Uri.encode(app.prefs.theme)

    /** Reload the page with the currently stored theme. */
    fun reloadTheme() {
        runOnUiThread { webView?.loadUrl(homeUrl()) }
    }

    private fun requestListingsPermissionOnce() {
        try {
            if (app.prefs.askedTvListings) return
            app.prefs.askedTvListings = true
            val perm = "android.permission.READ_TV_LISTINGS"
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(perm), 1)
            }
        } catch (_: Exception) {
        }
    }

    /** Dispatch an event to the page: TvHome.emit(name, json). Safe from any thread. */
    fun emit(name: String, json: String = "{}") {
        evalJs("window.TvHome && TvHome.emit(${JSONObject.quote(name)}, $json)")
    }

    /** Run a JS snippet on the UI thread. */
    fun evalJs(script: String) {
        runOnUiThread {
            try {
                webView?.evaluateJavascript(script, null)
            } catch (_: Exception) {
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        emit("home")
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val up = event.action == KeyEvent.ACTION_UP
        when (event.keyCode) {
            KeyEvent.KEYCODE_BACK -> {
                if (up) emit("back")
                return true
            }
            KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_SETTINGS, KeyEvent.KEYCODE_GUIDE -> {
                if (up) emit("menu")
                return true
            }
            KeyEvent.KEYCODE_PROG_RED -> return colorKey(up, "red")
            KeyEvent.KEYCODE_PROG_GREEN -> return colorKey(up, "green")
            KeyEvent.KEYCODE_PROG_YELLOW -> return colorKey(up, "yellow")
            KeyEvent.KEYCODE_PROG_BLUE -> return colorKey(up, "blue")
        }
        return super.dispatchKeyEvent(event)
    }

    private fun colorKey(up: Boolean, color: String): Boolean {
        if (up) emit("colorKey", JSONObject().put("color", color).toString())
        return true
    }

    @Deprecated("Handled via KEYCODE_BACK in dispatchKeyEvent; never finish the launcher.")
    override fun onBackPressed() {
        emit("back")
    }

    override fun onStart() {
        super.onStart()
        currentRef = WeakReference(this)
    }

    override fun onResume() {
        super.onResume()
        currentRef = WeakReference(this)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
        webView?.onResume()
        webView?.requestFocus()
        emit("resume")
        if (app.prefs.autoSoundbar) app.soundbarManager.ensureOn("resume")
    }

    override fun onPause() {
        webView?.onPause()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            val controller = WindowInsetsControllerCompat(window, window.decorView)
            controller.hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    override fun onDestroy() {
        bridge?.destroy()
        bridge = null
        if (currentRef?.get() === this) currentRef = null
        webView?.let {
            (it.parent as? ViewGroup)?.removeView(it)
            it.destroy()
        }
        webView = null
        super.onDestroy()
    }

    companion object {
        @Volatile private var currentRef: WeakReference<HomeActivity>? = null

        /** The live HomeActivity, if any (used by app-level code to forward events). */
        fun current(): HomeActivity? = currentRef?.get()
    }
}
