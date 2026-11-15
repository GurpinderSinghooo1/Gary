package com.gary.tvhome.dream

import android.graphics.Color
import android.net.Uri
import android.service.dreams.DreamService
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import com.gary.tvhome.TvHomeApp
import com.gary.tvhome.web.LocalPathHandlers

/**
 * Screensaver ("Daydream") that replaces Google's ad-filled ambient mode with the Washi lake scene:
 * big clock, weather, micro-season, slow drift, and burn-in protection. No app cards.
 * Weather comes straight from Open-Meteo in the page, so no bridge is exposed here.
 *
 * Turn it on (install.sh does this):
 *   adb shell settings put secure screensaver_components com.gary.tvhome/.dream.TvHomeDream
 *   adb shell settings put secure screensaver_enabled 1
 */
class TvHomeDream : DreamService() {
    private var webView: WebView? = null

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        isInteractive = false   // any key wakes the TV
        isFullscreen = true
        isScreenBright = false  // let the system dim a little

        val prefs = (application as TvHomeApp).prefs
        val loader = LocalPathHandlers(this).createLoader()
        val wv = WebView(this)
        wv.setBackgroundColor(Color.BLACK)
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.settings.allowFileAccess = false
        wv.settings.allowContentAccess = false
        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true
        }
        val url = Uri.Builder().scheme("https").authority(LocalPathHandlers.DOMAIN).path("/assets/web/home.html")
            .appendQueryParameter("theme", "washi")
            .appendQueryParameter("mode", "dream")
            .appendQueryParameter("lat", prefs.homeLat.toString())
            .appendQueryParameter("lon", prefs.homeLon.toString())
            .appendQueryParameter("city", prefs.homeName)
            .appendQueryParameter("home", prefs.secondName)
            .appendQueryParameter("tz", prefs.secondTz)
            .build()
        wv.loadUrl(url.toString())
        webView = wv
        setContentView(wv)
    }

    override fun onDetachedFromWindow() {
        webView?.destroy()
        webView = null
        super.onDetachedFromWindow()
    }
}
