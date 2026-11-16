package com.gary.tvhome

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import com.gary.tvhome.data.AppRepository
import com.gary.tvhome.data.InputRepository
import com.gary.tvhome.data.Prefs
import com.gary.tvhome.data.StatsRepository
import com.gary.tvhome.data.Store
import com.gary.tvhome.integrations.StravaClient
import com.gary.tvhome.integrations.TmdbClient
import com.gary.tvhome.data.SystemInfo
import com.gary.tvhome.data.WatchNextRepository
import com.gary.tvhome.data.WeatherRepository
import com.gary.tvhome.soundbar.SoundbarManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob

/**
 * Application: owns the singletons and a process-wide coroutine scope, and listens for
 * screen-on / dream-ended to wake the soundbar and tell the page ("screenOn" event).
 */
class TvHomeApp : Application() {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    lateinit var prefs: Prefs
        private set
    lateinit var appRepository: AppRepository
        private set
    lateinit var inputRepository: InputRepository
        private set
    lateinit var watchNextRepository: WatchNextRepository
        private set
    lateinit var weatherRepository: WeatherRepository
        private set
    lateinit var soundbarManager: SoundbarManager
        private set
    lateinit var statsRepository: StatsRepository
        private set
    lateinit var systemInfo: SystemInfo
        private set
    lateinit var store: Store
        private set
    lateinit var strava: StravaClient
        private set
    lateinit var tmdb: TmdbClient
        private set

    /** Pending bedtime timer (survives activity recreation). */
    @Volatile var bedtimeJob: Job? = null

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (prefs.autoSoundbar) soundbarManager.ensureOn("screen_on")
            HomeActivity.current()?.emit("screenOn")
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
        appRepository = AppRepository(this)
        inputRepository = InputRepository(this)
        watchNextRepository = WatchNextRepository(this)
        weatherRepository = WeatherRepository(prefs)
        soundbarManager = SoundbarManager(prefs, appScope)
        statsRepository = StatsRepository(this)
        systemInfo = SystemInfo(this, prefs)
        store = Store(this)
        strava = StravaClient(prefs)
        tmdb = TmdbClient(prefs)

        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_DREAMING_STOPPED)
        }
        ContextCompat.registerReceiver(this, screenReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
        soundbarManager.keepAlive()
    }
}
