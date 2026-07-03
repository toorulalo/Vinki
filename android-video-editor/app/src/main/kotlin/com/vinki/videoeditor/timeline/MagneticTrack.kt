package com.vinki.videoeditor.timeline

/**
 * Pista magnética: los clips forman una secuencia SIN huecos por construcción.
 *
 * Invariante clave: las posiciones temporales NO se almacenan — se DERIVAN
 * del orden (start del clip i = suma de duraciones de 0..i-1). Toda una clase
 * de bugs (huecos fantasma, solapes, drift acumulado tras N drags) es
 * irrepresentable en este modelo. Mover un clip = reordenar la lista (ripple
 * implícito), como en las timelines magnéticas profesionales.
 */
class MagneticTrack {

    private val clips = ArrayList<ClipNode>()

    val size: Int get() = clips.size
    val totalDurationMs: Long get() = clips.sumOf { it.durationMs }

    /** Vista derivada: cada clip con su rango temporal calculado. */
    fun placed(): List<PlacedClip> {
        var cursor = 0L
        return clips.map { clip ->
            val p = PlacedClip(clip, startMs = cursor, endMs = cursor + clip.durationMs)
            cursor = p.endMs
            p
        }
    }

    fun insert(index: Int, clip: ClipNode) {
        require(index in 0..clips.size) { "Índice fuera de rango: $index" }
        clips.add(index, clip)
    }

    fun append(clip: ClipNode) = clips.add(clip)

    fun removeAt(index: Int): ClipNode {
        require(index in clips.indices) { "Índice fuera de rango: $index" }
        return clips.removeAt(index)
    }

    /** Mover con ripple: el resto de clips se re-imanta automáticamente. */
    fun move(fromIndex: Int, toIndex: Int) {
        require(fromIndex in clips.indices) { "fromIndex fuera de rango" }
        require(toIndex in 0 until clips.size) { "toIndex fuera de rango" }
        if (fromIndex == toIndex) return
        val clip = clips.removeAt(fromIndex)
        clips.add(toIndex, clip)
    }

    /**
     * Divide el clip bajo [atMs] en dos (corte con S Pen). Devuelve el índice
     * del segundo fragmento, o null si el punto cae en una juntura o fuera.
     */
    fun split(atMs: Long, idGen: () -> NodeId): Int? {
        var cursor = 0L
        for ((index, clip) in clips.withIndex()) {
            val end = cursor + clip.durationMs
            if (atMs > cursor && atMs < end) {
                val offsetInClip = atMs - cursor
                val left = clip.copy(durationMs = offsetInClip)
                val right = clip.copy(
                    id = idGen(),
                    sourceInMs = clip.sourceInMs + offsetInClip,
                    durationMs = clip.durationMs - offsetInClip
                )
                clips[index] = left
                clips.add(index + 1, right)
                return index + 1
            }
            cursor = end
        }
        return null
    }

    /**
     * Imantado del playhead/gesto: si [timeMs] cae a menos de [thresholdMs]
     * de una juntura de clips, salta a ella. [thresholdMs] debe escalarse con
     * el zoom de la UI (umbral constante EN PANTALLA, no en ms).
     */
    fun snap(timeMs: Long, thresholdMs: Long): Long {
        var best = timeMs
        var bestDist = thresholdMs + 1
        var cursor = 0L
        for (clip in clips) {
            for (boundary in longArrayOf(cursor, cursor + clip.durationMs)) {
                val dist = kotlin.math.abs(boundary - timeMs)
                if (dist <= thresholdMs && dist < bestDist) {
                    best = boundary
                    bestDist = dist
                }
            }
            cursor += clip.durationMs
        }
        return best
    }

    /** Índice del clip visible en [timeMs], o null si está fuera de la pista. */
    fun clipIndexAt(timeMs: Long): Int? {
        var cursor = 0L
        for ((index, clip) in clips.withIndex()) {
            val end = cursor + clip.durationMs
            if (timeMs in cursor until end) return index
            cursor = end
        }
        return null
    }
}

data class PlacedClip(
    val clip: ClipNode,
    val startMs: Long,
    val endMs: Long
)
