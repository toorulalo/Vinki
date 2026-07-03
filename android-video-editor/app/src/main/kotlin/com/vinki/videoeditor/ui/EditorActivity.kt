package com.vinki.videoeditor.ui

import android.app.Activity
import android.os.Bundle
import android.view.WindowManager
import android.widget.FrameLayout
import com.vinki.videoeditor.timeline.MagneticTrack

/**
 * Activity contenedora mínima. La UI real del editor (preview GL + timeline)
 * se monta aquí; por ahora ancla la TimelineView y fija el modo 90Hz.
 */
class EditorActivity : Activity() {

    private lateinit var timeline: TimelineView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Preferir el modo de pantalla de mayor tasa (90Hz WUXGA+ en la Tab S10 Lite).
        val best = display?.supportedModes?.maxByOrNull { it.refreshRate }
        if (best != null) {
            window.attributes = window.attributes.apply {
                preferredDisplayModeId = best.modeId
            }
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        timeline = TimelineView(this).apply {
            track = MagneticTrack()
        }
        setContentView(FrameLayout(this).apply { addView(timeline) })
    }
}
