package com.vinki.videoeditor.core

import android.content.Context
import android.media.MediaExtractor
import android.net.Uri

/**
 * Fuente de video de la timeline. [durationUs] lo aporta la UI (leído con
 * MediaMetadataRetriever al añadir el clip): se usa para el offset de PTS
 * entre clips y para las fronteras de transición.
 */
data class VideoSource(
    val uri: Uri? = null,
    val path: String? = null,
    val durationUs: Long = 0
) {
    init {
        require(uri != null || path != null) { "VideoSource sin uri ni path" }
    }

    fun openExtractor(context: Context): MediaExtractor {
        val extractor = MediaExtractor()
        if (uri != null) {
            extractor.setDataSource(context, uri, null)
        } else {
            extractor.setDataSource(path!!)
        }
        return extractor
    }
}

/** Subtítulo a quemar en el render (texto final, ya editado por el usuario). */
data class BurnSubtitle(
    val startMs: Long,
    val endMs: Long,
    val text: String
)

/** Directivas de render por-frame para el hilo GL. */
data class RenderDirectives(
    /** PTS (µs) de las junturas entre clips (sin incluir 0 ni el final). */
    val clipBoundariesUs: List<Long> = emptyList(),
    /** Transición "whip pan": rampa de motion blur alrededor de cada juntura. */
    val whipPanTransitions: Boolean = false,
    /** Subtítulos a quemar, ordenados por startMs. */
    val subtitles: List<BurnSubtitle> = emptyList()
)
