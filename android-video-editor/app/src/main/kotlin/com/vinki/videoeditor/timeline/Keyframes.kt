package com.vinki.videoeditor.timeline

/**
 * Curva de easing cúbica Bézier estilo CSS cubic-bezier(x1,y1,x2,y2):
 * P0=(0,0) y P3=(1,1) fijos; los puntos de control (x1,y1)/(x2,y2) son las
 * TANGENTES de salida/entrada del tramo. El S Pen escribe exactamente estos
 * cuatro valores (ver SPenKeyframeController).
 *
 * x se restringe a [0,1] para que x(t) sea monótona → siempre hay una única
 * solución temporal y la interpolación jamás retrocede.
 */
data class BezierEase(
    val x1: Float,
    val y1: Float,
    val x2: Float,
    val y2: Float
) {
    init {
        require(x1 in 0f..1f && x2 in 0f..1f) { "x1/x2 deben estar en [0,1]" }
    }

    /**
     * Evalúa la curva: dado el progreso temporal u ∈ [0,1], devuelve el
     * progreso del valor. Newton-Raphson (rápido: la curva es suave) con
     * bisección de respaldo (robusta: converge siempre).
     */
    fun evaluate(u: Float): Float {
        if (u <= 0f) return 0f
        if (u >= 1f) return 1f
        val t = solveT(u)
        return sampleY(t)
    }

    private fun sampleX(t: Float): Float {
        val omt = 1f - t
        return 3f * omt * omt * t * x1 + 3f * omt * t * t * x2 + t * t * t
    }

    private fun sampleY(t: Float): Float {
        val omt = 1f - t
        return 3f * omt * omt * t * y1 + 3f * omt * t * t * y2 + t * t * t
    }

    private fun sampleDx(t: Float): Float {
        val omt = 1f - t
        return 3f * omt * omt * x1 + 6f * omt * t * (x2 - x1) + 3f * t * t * (1f - x2)
    }

    private fun solveT(x: Float): Float {
        // Newton: 8 iteraciones bastan para error < 1e-6 en curvas razonables.
        var t = x
        repeat(8) {
            val err = sampleX(t) - x
            if (kotlin.math.abs(err) < 1e-6f) return t
            val dx = sampleDx(t)
            if (kotlin.math.abs(dx) < 1e-6f) return@repeat
            t = (t - err / dx).coerceIn(0f, 1f)
        }
        // Respaldo por bisección si Newton no convergió (dx ~ 0 en extremos).
        var lo = 0f
        var hi = 1f
        var mid = t
        repeat(24) {
            mid = (lo + hi) * 0.5f
            if (sampleX(mid) < x) lo = mid else hi = mid
        }
        return mid
    }

    companion object {
        val LINEAR = BezierEase(0.25f, 0.25f, 0.75f, 0.75f)
        val EASE_IN_OUT = BezierEase(0.42f, 0f, 0.58f, 1f)
    }
}

/** Fotograma clave de una propiedad animable (posición, escala, opacidad…). */
data class Keyframe(
    val timeMs: Long,
    val value: Float,
    /** Easing del TRAMO que parte de este keyframe hacia el siguiente. */
    val ease: BezierEase = BezierEase.EASE_IN_OUT
)

/**
 * Pista de keyframes de una propiedad. Mantiene orden temporal como
 * invariante interno; la evaluación es O(log n) por búsqueda binaria —
 * apta para llamarse por frame a 90Hz sobre decenas de pistas.
 */
class KeyframeTrack {

    private val frames = ArrayList<Keyframe>()

    val keyframes: List<Keyframe> get() = frames

    fun put(keyframe: Keyframe) {
        val idx = frames.binarySearchBy(keyframe.timeMs) { it.timeMs }
        if (idx >= 0) frames[idx] = keyframe else frames.add(-idx - 1, keyframe)
    }

    fun removeAt(timeMs: Long): Boolean {
        val idx = frames.binarySearchBy(timeMs) { it.timeMs }
        if (idx < 0) return false
        frames.removeAt(idx)
        return true
    }

    /** Reemplaza el easing del tramo cuyo keyframe inicial está en [timeMs]. */
    fun setEase(timeMs: Long, ease: BezierEase): Boolean {
        val idx = frames.binarySearchBy(timeMs) { it.timeMs }
        if (idx < 0) return false
        frames[idx] = frames[idx].copy(ease = ease)
        return true
    }

    fun valueAt(timeMs: Long): Float {
        if (frames.isEmpty()) return 0f
        if (timeMs <= frames.first().timeMs) return frames.first().value
        if (timeMs >= frames.last().timeMs) return frames.last().value

        var idx = frames.binarySearchBy(timeMs) { it.timeMs }
        if (idx >= 0) return frames[idx].value
        idx = -idx - 2 // keyframe inmediatamente anterior

        val a = frames[idx]
        val b = frames[idx + 1]
        val span = (b.timeMs - a.timeMs).toFloat()
        if (span <= 0f) return b.value

        val u = (timeMs - a.timeMs) / span
        val eased = a.ease.evaluate(u)
        return a.value + (b.value - a.value) * eased
    }
}
