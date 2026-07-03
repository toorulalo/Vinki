package com.vinki.videoeditor.input

import android.view.MotionEvent
import android.view.View
import com.vinki.videoeditor.timeline.BezierEase
import kotlin.math.PI

/**
 * Mapeo S Pen → tangentes Bézier para esculpir curvas de interpolación.
 *
 * El S Pen de la Tab S10 Lite reporta:
 *   AXIS_PRESSURE    [0,1]      → "energía" del easing (longitud de tangente)
 *   AXIS_TILT        [0, π/2]   → asimetría in/out (0 = perpendicular)
 *   AXIS_ORIENTATION [-π, π]    → hacia dónde se inclina: elige QUÉ extremo
 *                                  de la curva recibe la asimetría
 *
 * Semántica física, pensada para memoria muscular:
 *   - Apretar fuerte      → curva agresiva (aceleración/frenada marcadas)
 *   - Pluma vertical      → ease-in-out simétrico
 *   - Tumbar hacia delante→ el peso se va al ease-out (frenada suave)
 *   - Tumbar hacia atrás  → el peso se va al ease-in (arranque suave)
 *
 * El digitalizador entrega lotes a 360Hz sobre una UI de 90Hz: cada
 * MotionEvent trae ~4 muestras históricas. Se procesan TODAS (no solo la
 * puntera) a través de un filtro EMA — sin aliasing de muestreo y sin jitter.
 */
class SPenKeyframeController(
    private val onEasePreview: (BezierEase) -> Unit,
    private val onEaseCommitted: (BezierEase) -> Unit
) {

    private var filteredPressure = 0.5f
    private var filteredTilt = 0f
    private var filteredOrientation = 0f
    private var tracking = false

    /**
     * Conectar desde View.onTouchEvent. Devuelve true si consumió el evento
     * (solo reacciona al stylus; los dedos siguen su curso para scroll).
     */
    fun onTouchEvent(view: View, event: MotionEvent): Boolean {
        if (event.getToolType(0) != MotionEvent.TOOL_TYPE_STYLUS) return false

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                tracking = true
                // Ruta de despacho sin bufferizar: muestras del digitalizador
                // entregadas tan pronto llegan, no agrupadas por vsync.
                // Crítico para que el trazo se sienta "pegado" a la pluma a 90Hz.
                view.requestUnbufferedDispatch(event)
                seedFilters(event)
                onEasePreview(currentEase())
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                if (!tracking) return false
                // Muestras históricas primero (orden cronológico), puntera después.
                for (h in 0 until event.historySize) {
                    integrate(
                        pressure = event.getHistoricalPressure(0, h),
                        tilt = event.getHistoricalAxisValue(MotionEvent.AXIS_TILT, 0, h),
                        orientation = event.getHistoricalAxisValue(
                            MotionEvent.AXIS_ORIENTATION, 0, h
                        )
                    )
                }
                integrate(
                    pressure = event.getPressure(0),
                    tilt = event.getAxisValue(MotionEvent.AXIS_TILT, 0),
                    orientation = event.getAxisValue(MotionEvent.AXIS_ORIENTATION, 0)
                )
                onEasePreview(currentEase())
                return true
            }

            MotionEvent.ACTION_UP -> {
                if (!tracking) return false
                tracking = false
                onEaseCommitted(currentEase())
                return true
            }

            MotionEvent.ACTION_CANCEL -> {
                tracking = false
                return true
            }
        }
        return false
    }

    private fun seedFilters(event: MotionEvent) {
        filteredPressure = event.getPressure(0).coerceIn(0f, 1f)
        filteredTilt = event.getAxisValue(MotionEvent.AXIS_TILT, 0)
        filteredOrientation = event.getAxisValue(MotionEvent.AXIS_ORIENTATION, 0)
    }

    private fun integrate(pressure: Float, tilt: Float, orientation: Float) {
        // EMA con α=0.35: ~3 muestras de retardo de grupo a 360Hz (≈8ms) —
        // imperceptible, pero mata el ruido del sensor de presión.
        filteredPressure += EMA_ALPHA * (pressure.coerceIn(0f, 1f) - filteredPressure)
        filteredTilt += EMA_ALPHA * (tilt - filteredTilt)
        filteredOrientation += EMA_ALPHA * (orientation - filteredOrientation)
    }

    /**
     * Construcción de la curva:
     *   strength ∈ [0.05, 0.95]  ← presión (longitud de ambas tangentes)
     *   bias     ∈ [-1, 1]       ← tilt × signo(orientación): reparto in/out
     */
    private fun currentEase(): BezierEase {
        val strength = 0.05f + filteredPressure * 0.90f

        val tiltNorm = (filteredTilt / (PI.toFloat() / 2f)).coerceIn(0f, 1f)
        // Orientación hacia "delante" (|o| < π/2) → bias positivo (ease-out).
        val direction = if (kotlin.math.abs(filteredOrientation) < PI.toFloat() / 2f) 1f else -1f
        val bias = tiltNorm * direction

        val inWeight = strength * (1f - bias).coerceIn(0.1f, 2f) * 0.5f
        val outWeight = strength * (1f + bias).coerceIn(0.1f, 2f) * 0.5f

        // Tangente de salida (P1) plana en Y → arranque suave proporcional a inWeight.
        // Tangente de entrada (P2) plana en Y=1 → llegada suave proporcional a outWeight.
        return BezierEase(
            x1 = inWeight.coerceIn(0f, 1f),
            y1 = 0f,
            x2 = (1f - outWeight).coerceIn(0f, 1f),
            y2 = 1f
        )
    }

    companion object {
        private const val EMA_ALPHA = 0.35f
    }
}
