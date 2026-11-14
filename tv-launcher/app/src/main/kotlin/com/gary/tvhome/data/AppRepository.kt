package com.gary.tvhome.data

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import org.json.JSONArray
import org.json.JSONObject

/** A well-known streaming app with candidate package names (first installed wins). */
data class KnownApp(val id: String, val label: String, val packages: List<String>)

/** Lists launchable apps (known streaming apps first) and builds launch intents. */
class AppRepository(context: Context) {
    private val ctx = context.applicationContext
    private val pm: PackageManager = ctx.packageManager

    fun launchIntent(pkg: String): Intent? =
        pm.getLeanbackLaunchIntentForPackage(pkg) ?: pm.getLaunchIntentForPackage(pkg)

    fun isInstalled(pkg: String): Boolean = launchIntent(pkg) != null

    private fun appJson(id: String, pkg: String, label: String, installed: Boolean): JSONObject =
        JSONObject()
            .put("id", id)
            .put("packageName", pkg)
            .put("label", label)
            .put("installed", installed)
            .put("iconUrl", "/icon/$pkg")
            .put("bannerUrl", "/banner/$pkg")

    fun list(): JSONArray {
        val out = JSONArray()
        val seen = HashSet<String>()
        for (k in KNOWN) {
            val installedPkg = k.packages.firstOrNull { isInstalled(it) }
            val pkg = installedPkg ?: k.packages.first()
            seen.addAll(k.packages)
            out.put(appJson(k.id, pkg, k.label, installedPkg != null))
        }

        val others = ArrayList<Pair<String, String>>() // pkg to label
        val categories = listOf(Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER)
        for (cat in categories) {
            val intent = Intent(Intent.ACTION_MAIN).addCategory(cat)
            val infos = try {
                pm.queryIntentActivities(intent, 0)
            } catch (_: Exception) {
                emptyList()
            }
            for (ri in infos) {
                val pkg = ri.activityInfo?.packageName ?: continue
                if (pkg == ctx.packageName || !seen.add(pkg)) continue
                val label = try {
                    ri.loadLabel(pm).toString()
                } catch (_: Exception) {
                    pkg
                }
                others.add(pkg to label)
            }
        }
        others.sortBy { it.second.lowercase() }
        for ((pkg, label) in others) out.put(appJson(pkg, pkg, label, true))
        return out
    }

    companion object {
        val KNOWN: List<KnownApp> = listOf(
            KnownApp("netflix", "Netflix", listOf("com.netflix.ninja")),
            KnownApp("youtube", "YouTube", listOf("com.google.android.youtube.tv")),
            KnownApp("disney", "Disney+", listOf("com.disney.disneyplus")),
            KnownApp(
                "prime", "Prime Video",
                listOf("com.amazon.amazonvideo.livingroom", "com.amazon.avod.thirdpartyclient")
            ),
            KnownApp("paramount", "Paramount+", listOf("com.cbs.ott", "com.cbs.app", "com.paramount.plus"))
        )

        val KNOWN_PACKAGES: Set<String> = KNOWN.flatMap { it.packages }.toSet()
    }
}
