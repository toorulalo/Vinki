package com.vinki.videoeditor.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.Choreographer
import android.view.MotionEvent
import android.view.View
import com.vinki.videoeditor.input.SPenKeyframeController
import com.vinki.videoeditor.timeline.BezierEase
import com.vinki.videoeditor.timeline.MagneticTrack

/**
 * Vista de línea de tiempo magnética — minimalista y fluida a 90Hz.
 *
 * Principios de rendimiento:
 *  - requestedFrameRate = HIGH (API 35): pide al compositor la cadencia de
 *    90Hz del panel de la Tab S10 Lite mientras hay interacción.
 *  - Cero asignaciones en onDraw: Paints/Rects pre-creados, sin autoboxing.
 *  - Choreographer solo mientras hay animación activa (playhead en marcha);
 *    en reposo la vista no consume ni un frame.
 *  - Dedo = scroll/scrub; S Pen = esculpir easing del keyframe seleccionado.
 */
class TimelineView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    var track: MagneticTrack = MagneticTrack()
        set(value) {
            field = value
            invalidate()
        }

    /** ms por píxel — zoom de la timeline. */
    var msPerPx: Float = 20f
        set(value) {
            field = value.coerceIn(1f, 200f)
            invalidate()
        }

    var playheadMs: Long = 0
        set(value) {
            field = value.coerceAtLeast(0)
            invalidate()
        }

    var onEaseSculpted: ((BezierEase) -> Unit)? = null

    private val sPen = SPenKeyframeController(
        onEasePreview = { ease ->
            previewEase = ease
            invalidate()
        },
        onEaseCommitted = { ease ->
            previewEase = null
            onEaseSculpted?.invoke(ease)
            invalidate()
        }
    )

    private var previewEase: BezierEase? = null
    private var lastTouchX = 0f
    private var scrolling = false

    private var playing = false
    private var lastFrameNanos = 0L

    // --- Paints pre-creados (regla de oro: onDraw sin new) ---
    private val clipPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF2E7D52.toInt() }
    private val clipAltPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF3E9D6A.toInt() }
    private val junctionPaint = Paint().apply { color = 0xFFF5F1EB.toInt(); strokeWidth = 2f }
    private val playheadPaint = Paint().apply { color = 0xFFE07240.toInt(); strokeWidth = 4f }
    private val easePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFE07240.toInt(); style = Paint.Style.STROKE; strokeWidth = 3f
    }
    private val clipRect = RectF()

    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (!playing) return
            if (lastFrameNanos != 0L) {
                val deltaMs = (frameTimeNanos - lastFrameNanos) / 1_000_000
                playheadMs = (playheadMs + deltaMs)
                    .coerceAtMost(track.totalDurationMs)
                if (playheadMs >= track.totalDurationMs) playing = false
            }
            lastFrameNanos = frameTimeNanos
            if (playing) Choreographer.getInstance().postFrameCallback(this)
        }
    }

    init {
        // Android 15: sugerir cadencia alta al frame-rate arbiter del sistema.
        requestedFrameRate = REQUESTED_FRAME_RATE_CATEGORY_HIGH
    }

    fun play() {
        if (playing) return
        playing = true
        lastFrameNanos = 0L
        Choreographer.getInstance().postFrameCallback(frameCallback)
    }

    fun pause() {
        playing = false
    }

    override fun onDetachedFromWindow() {
        // Cortar el callback: un Choreographer huérfano retiene la View (leak).
        playing = false
        Choreographer.getInstance().removeFrameCallback(frameCallback)
        super.onDetachedFromWindow()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        // El S Pen tiene prioridad: esculpe curvas, no scrollea.
        if (sPen.onTouchEvent(this, event)) return true

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                scrolling = true
                lastTouchX = event.x
                parent?.requestDisallowInterceptTouchEvent(true)
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                if (!scrolling) return false
                val dx = event.x - lastTouchX
                lastTouchX = event.x
                val raw = playheadMs - (dx * msPerPx).toLong()
                // Imantado con umbral constante EN PANTALLA (12dp → ms vía zoom).
                val thresholdMs = (12f * resources.displayMetrics.density * msPerPx).toLong()
                playheadMs = track.snap(raw.coerceIn(0, track.totalDurationMs), thresholdMs)
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                scrolling = false
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val h = height.toFloat()
        val trackTop = h * 0.30f
        val trackBottom = h * 0.78f
        val originPx = width / 2f - playheadMs / msPerPx

        // Clips imantados: contiguos por construcción del modelo.
        for ((i, placed) in track.placed().withIndex()) {
            val left = originPx + placed.startMs / msPerPx
            val right = originPx + placed.endMs / msPerPx
            if (right < 0f || left > width) continue // culling fuera de pantalla

            clipRect.set(left + 1f, trackTop, right - 1f, trackBottom)
            canvas.drawRoundRect(clipRect, 10f, 10f, if (i % 2 == 0) clipPaint else clipAltPaint)
            canvas.drawLine(right, trackTop, right, trackBottom, junctionPaint)
        }

        // Playhead fijo al centro (la timeline se mueve bajo él).
        canvas.drawLine(width / 2f, 0f, width / 2f, h, playheadPaint)

        // Overlay de la curva que el S Pen está esculpiendo en vivo.
        previewEase?.let { drawEaseOverlay(canvas, it) }
    }

    private fun drawEaseOverlay(canvas: Canvas, ease: BezierEase) {
        val size = height * 0.26f
        val ox = width - size - 24f
        val oy = 24f
        var prevX = ox
        var prevY = oy + size
        val steps = 24
        for (s in 1..steps) {
            val u = s / steps.toFloat()
            val v = ease.evaluate(u)
            val x = ox + u * size
            val y = oy + size - v * size
            canvas.drawLine(prevX, prevY, x, y, easePaint)
            prevX = x
            prevY = y
        }
    }
}
