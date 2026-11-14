package com.gary.tvhome.web

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.net.Uri
import android.util.Base64
import android.util.LruCache
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

/**
 * Builds the WebViewAssetLoader serving https://appassets.androidplatform.net/ :
 *   /assets/<file>   bundled HTML/JS/CSS
 *   /icon/<pkg>      app icon PNG (192px)
 *   /banner/<pkg>    app banner PNG (320x180), falling back to the icon
 *   /art/<b64url>    content:// or android.resource:// image (Watch Next posters)
 */
class LocalPathHandlers(context: Context) {
    private val ctx = context.applicationContext
    private val pm = ctx.packageManager
    private val cache = object : LruCache<String, ByteArray>(48) {}

    fun createLoader(): WebViewAssetLoader =
        WebViewAssetLoader.Builder()
            .setDomain(DOMAIN)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(ctx))
            .addPathHandler("/icon/", WebViewAssetLoader.PathHandler { path -> iconResponse(path) })
            .addPathHandler("/banner/", WebViewAssetLoader.PathHandler { path -> bannerResponse(path) })
            .addPathHandler("/art/", WebViewAssetLoader.PathHandler { path -> artResponse(path) })
            .build()

    private fun png(bytes: ByteArray) = WebResourceResponse("image/png", null, ByteArrayInputStream(bytes))

    private fun validPkg(p: String) = p.isNotEmpty() && PKG_RE.matches(p)

    private fun iconResponse(path: String): WebResourceResponse? {
        val pkg = path.trim('/')
        if (!validPkg(pkg)) return null
        return try {
            val key = "icon:$pkg"
            val bytes = cache.get(key) ?: run {
                val d = pm.getApplicationIcon(pkg)
                encode(render(d, 192, 192, fit = false)).also { cache.put(key, it) }
            }
            png(bytes)
        } catch (_: Exception) {
            null
        }
    }

    private fun bannerResponse(path: String): WebResourceResponse? {
        val pkg = path.trim('/')
        if (!validPkg(pkg)) return null
        return try {
            val key = "banner:$pkg"
            val bytes = cache.get(key) ?: run {
                val banner = findBanner(pkg)
                val bmp = if (banner != null) {
                    render(banner, 320, 180, fit = false)
                } else {
                    // Fall back to the app icon centred on a transparent banner canvas.
                    render(pm.getApplicationIcon(pkg), 320, 180, fit = true)
                }
                encode(bmp).also { cache.put(key, it) }
            }
            png(bytes)
        } catch (_: Exception) {
            null
        }
    }

    private fun findBanner(pkg: String): Drawable? {
        val appBanner = try {
            pm.getApplicationBanner(pkg)
        } catch (_: Exception) {
            null
        }
        if (appBanner != null) return appBanner
        return try {
            pm.getLeanbackLaunchIntentForPackage(pkg)?.let { pm.getActivityBanner(it) }
        } catch (_: Exception) {
            null
        }
    }

    private fun artResponse(path: String): WebResourceResponse? {
        return try {
            val raw = Base64.decode(path.trim('/'), Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            val uri = Uri.parse(String(raw, Charsets.UTF_8))
            val scheme = uri.scheme?.lowercase()
            if (scheme != "content" && scheme != "android.resource") return null
            val stream = ctx.contentResolver.openInputStream(uri) ?: return null
            val mime = ctx.contentResolver.getType(uri) ?: "image/*"
            WebResourceResponse(mime, null, stream)
        } catch (_: Exception) {
            null
        }
    }

    private fun render(d: Drawable, w: Int, h: Int, fit: Boolean): Bitmap {
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        if (fit) {
            val side = minOf(w, h)
            val left = (w - side) / 2
            val top = (h - side) / 2
            d.setBounds(left, top, left + side, top + side)
        } else {
            d.setBounds(0, 0, w, h)
        }
        d.draw(c)
        return bmp
    }

    private fun encode(b: Bitmap): ByteArray {
        val out = ByteArrayOutputStream()
        b.compress(Bitmap.CompressFormat.PNG, 100, out)
        b.recycle()
        return out.toByteArray()
    }

    companion object {
        const val DOMAIN = "appassets.androidplatform.net"
        private val PKG_RE = Regex("[A-Za-z0-9._]+")

        /** Relative URL the page can use to fetch a content:// / android.resource:// image. */
        fun artUrl(uri: String): String =
            "/art/" + Base64.encodeToString(
                uri.toByteArray(Charsets.UTF_8),
                Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
            )
    }
}
