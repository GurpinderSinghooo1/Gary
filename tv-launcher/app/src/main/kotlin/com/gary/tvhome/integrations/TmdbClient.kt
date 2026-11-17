package com.gary.tvhome.integrations

import com.gary.tvhome.data.Prefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * TMDB (free API key) for Date Night: movies available on the services you pay for,
 * in your country, filtered by mood. Streaming availability is JustWatch data via TMDB.
 *
 * picks(mood, count) -> [{id, title, overview, year, rating, runtimeMin, genres:[..],
 *                         posterUrl, backdropUrl, provider, appId}]
 */
class TmdbClient(private val prefs: Prefs) {
    private val cache = java.util.concurrent.ConcurrentHashMap<String, Pair<Long, JSONArray>>()

    suspend fun picks(mood: String, count: Int = 3, fresh: Boolean = false): JSONArray = withContext(Dispatchers.IO) {
        require(prefs.tmdbConfigured) { "TMDB key not set" }
        val key = "$mood:$count"
        if (!fresh) cache[key]?.let { (t, v) -> if (System.currentTimeMillis() - t < 6 * 3600_000L) return@withContext v }

        val genres = MOODS[mood.lowercase()] ?: MOODS.getValue("romantic")
        val region = prefs.region.ifBlank { "CA" }
        val page = (1..3).random()
        val url = "$BASE/discover/movie?api_key=${Http.enc(prefs.tmdbKey)}" +
            "&with_genres=${Http.enc(genres)}&watch_region=$region" +
            "&with_watch_providers=${Http.enc(PROVIDERS.keys.joinToString("|"))}" +
            "&with_watch_monetization_types=flatrate&sort_by=popularity.desc" +
            "&vote_average.gte=6.4&vote_count.gte=300&include_adult=false&page=$page"
        val results = JSONObject(Http.request(url)).optJSONArray("results") ?: JSONArray()
        val idx = (0 until results.length()).shuffled().take(count)

        val out = JSONArray()
        for (i in idx) {
            val m = results.optJSONObject(i) ?: continue
            val id = m.optLong("id")
            var runtime = 0
            val genreNames = JSONArray()
            var provider = ""
            try {
                val d = JSONObject(
                    Http.request("$BASE/movie/$id?api_key=${Http.enc(prefs.tmdbKey)}&append_to_response=watch/providers")
                )
                runtime = d.optInt("runtime", 0)
                d.optJSONArray("genres")?.let { g -> for (k in 0 until g.length()) genreNames.put(g.optJSONObject(k)?.optString("name")) }
                val flat = d.optJSONObject("watch/providers")?.optJSONObject("results")
                    ?.optJSONObject(region)?.optJSONArray("flatrate")
                if (flat != null) {
                    for (k in 0 until flat.length()) {
                        val p = flat.optJSONObject(k) ?: continue
                        if (PROVIDERS.containsKey(p.optInt("provider_id"))) { provider = p.optString("provider_name"); break }
                    }
                }
            } catch (_: Exception) {
            }
            val appId = PROVIDERS.entries.firstOrNull { provider.isNotEmpty() && it.value.second == provider }?.value?.first
                ?: appIdFromName(provider)
            out.put(JSONObject()
                .put("id", id)
                .put("title", m.optString("title"))
                .put("overview", m.optString("overview"))
                .put("year", m.optString("release_date").take(4))
                .put("rating", m.optDouble("vote_average", 0.0))
                .put("runtimeMin", runtime)
                .put("genres", genreNames)
                .put("posterUrl", m.optString("poster_path").takeIf { it.isNotBlank() }?.let { "$IMG/w500$it" } ?: JSONObject.NULL)
                .put("backdropUrl", m.optString("backdrop_path").takeIf { it.isNotBlank() }?.let { "$IMG/w1280$it" } ?: JSONObject.NULL)
                .put("provider", provider)
                .put("appId", appId ?: JSONObject.NULL))
        }
        cache[key] = System.currentTimeMillis() to out
        out
    }

    private fun appIdFromName(n: String): String? = when {
        n.contains("Netflix", true) -> "netflix"
        n.contains("Disney", true) -> "disney"
        n.contains("Amazon", true) || n.contains("Prime", true) -> "prime"
        n.contains("Paramount", true) -> "paramount"
        else -> null
    }

    companion object {
        private const val BASE = "https://api.themoviedb.org/3"
        private const val IMG = "https://image.tmdb.org/t/p"
        /** TMDB genre ids: | = any of. */
        val MOODS = mapOf(
            "romantic" to "10749",
            "funny" to "35",
            "thriller" to "53|9648",
            "cozy" to "10751|16",
            "action" to "28|12",
        )
        /** TMDB watch-provider id -> (our app id, provider name). Paramount+ has two ids. */
        val PROVIDERS = mapOf(
            8 to ("netflix" to "Netflix"),
            9 to ("prime" to "Amazon Prime Video"),
            119 to ("prime" to "Amazon Prime Video"),
            337 to ("disney" to "Disney Plus"),
            531 to ("paramount" to "Paramount Plus"),
            2303 to ("paramount" to "Paramount Plus Premium"),
        )
    }
}
