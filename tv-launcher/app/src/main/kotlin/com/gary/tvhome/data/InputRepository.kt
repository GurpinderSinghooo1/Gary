package com.gary.tvhome.data

import android.content.Context
import android.content.Intent
import android.media.tv.TvContract
import android.media.tv.TvInputManager
import org.json.JSONArray
import org.json.JSONObject

/** The TV's physical inputs (HDMI 1, HDMI 2, AV...), so they can be opened from the menu. */
class InputRepository(context: Context) {
    private val ctx = context.applicationContext

    /** [{id,label,connected}] for every visible passthrough input. Empty on boxes without inputs. */
    fun list(): JSONArray {
        val out = JSONArray()
        val mgr = ctx.getSystemService(Context.TV_INPUT_SERVICE) as? TvInputManager ?: return out
        val inputs = try {
            mgr.tvInputList ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
        for (info in inputs) {
            try {
                if (!info.isPassthroughInput || info.isHidden(ctx)) continue
                val label = (info.loadCustomLabel(ctx) ?: info.loadLabel(ctx))?.toString()
                if (label.isNullOrBlank()) continue
                val connected = mgr.getInputState(info.id) != TvInputManager.INPUT_STATE_DISCONNECTED
                out.put(JSONObject().put("id", info.id).put("label", label).put("connected", connected))
            } catch (_: Exception) {
                // one broken input must not hide the others
            }
        }
        return out
    }

    /** Intent that switches the TV to the given input (handled by the TV's own input app). */
    fun intent(inputId: String): Intent =
        Intent(Intent.ACTION_VIEW, TvContract.buildChannelUriForPassthroughInput(inputId))
}
