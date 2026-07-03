package com.vinki.videoeditor.core

import android.content.Context
import android.graphics.SurfaceTexture
import android.media.MediaCodec
import android.opengl.EGLSurface
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.view.Surface
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * HILO 2 — Gestor del contexto EGL (GLES 3.0).
 *
 * Posee: EglCore, el EGLSurface de ventana creado sobre el input-surface del
 * encoder, la textura GL_TEXTURE_EXTERNAL_OES y su SurfaceTexture.
 *
 * onFrameAvailable se registra con el Handler de este HandlerThread, de modo
 * que el callback YA llega en el hilo GL — sin saltos de hilo ni locks:
 *   updateTexImage() → getTransformMatrix() → drawFrame() →
 *   eglPresentationTimeANDROID(pts) → swapBuffers() → liberar slot al Hilo 1.
 *
 * EOS: el Hilo 1 anuncia cuántos frames volcó ([renderedFrames]); este hilo
 * cuenta los consumidos y, cuando decoder terminó y consumed == rendered,
 * llama a encoder.signalEndOfInputStream() — que el Hilo 3 verá como EOS.
 */
class GlRenderThread(
    private val context: Context,
    private val width: Int,
    private val height: Int,
    private val encoderInputSurface: Surface,
    private val encoder: MediaCodec,
    private val frameSlots: java.util.concurrent.Semaphore,
    private val renderedFrames: AtomicLong,
    private val directives: RenderDirectives = RenderDirectives(),
    private val onFrameEncodedTick: (ptsUs: Long) -> Unit,
    private val onError: (Throwable) -> Unit
) : HandlerThread("Vinki-GlRender"), SurfaceTexture.OnFrameAvailableListener {

    // Estado de subtítulos (solo tocado desde el hilo GL).
    private var activeSubtitleIndex = -1

    private var eglCore: EglCore? = null
    private var windowSurface: EGLSurface? = null
    private var renderer: FramePipelineRenderer? = null
    private var surfaceTexture: SurfaceTexture? = null

    /** Surface que consume el decoder (Hilo 1). Válido tras awaitSurfaceReady(). */
    @Volatile
    var decoderSurface: Surface? = null
        private set

    private lateinit var handler: Handler
    private val surfaceReady = CountDownLatch(1)
    private val consumedFrames = AtomicLong(0)
    private val decoderDone = AtomicBoolean(false)
    private val eosSignalled = AtomicBoolean(false)
    private val texMatrix = FloatArray(16)

    /** Acceso al renderer para configurar efectos — SIEMPRE vía [post]. */
    fun post(task: (FramePipelineRenderer) -> Unit) {
        handler.post {
            renderer?.let {
                try {
                    task(it)
                } catch (t: Throwable) {
                    onError(t)
                }
            }
        }
    }

    override fun onLooperPrepared() {
        try {
            handler = Handler(looper)
            val egl = EglCore()
            eglCore = egl
            val window = egl.createWindowSurface(encoderInputSurface)
            windowSurface = window
            egl.makeCurrent(window)

            val pipeline = FramePipelineRenderer(context, width, height)
            renderer = pipeline

            val st = SurfaceTexture(pipeline.oesTextureId)
            st.setDefaultBufferSize(width, height)
            // El listener se despacha en ESTE hilo gracias al handler explícito.
            st.setOnFrameAvailableListener(this, handler)
            surfaceTexture = st
            decoderSurface = Surface(st)

            surfaceReady.countDown()
        } catch (t: Throwable) {
            Log.e(TAG, "Fallo inicializando contexto EGL", t)
            surfaceReady.countDown() // desbloquear al orquestador aunque haya fallo
            onError(t)
        }
    }

    fun awaitSurfaceReady(timeoutMs: Long = 5_000): Surface {
        check(surfaceReady.await(timeoutMs, TimeUnit.MILLISECONDS)) {
            "Timeout esperando la inicialización del hilo GL"
        }
        return decoderSurface
            ?: throw IllegalStateException("El hilo GL no pudo crear el Surface del decoder")
    }

    override fun onFrameAvailable(st: SurfaceTexture) {
        // Ya estamos en el hilo GL (listener registrado con nuestro handler).
        val egl = eglCore ?: return
        val window = windowSurface ?: return
        val pipeline = renderer ?: return
        try {
            st.updateTexImage()
            // Rotación/crop de hardware del productor: obligatorio.
            st.getTransformMatrix(texMatrix)

            val ptsUs = st.timestamp / 1000L
            applyWhipPan(pipeline, ptsUs)
            applySubtitle(pipeline, ptsUs / 1000L)

            pipeline.drawFrame(texMatrix)

            val ptsNs = st.timestamp
            egl.setPresentationTime(window, ptsNs)
            if (!egl.swapBuffers(window)) {
                throw IllegalStateException("eglSwapBuffers falló — ¿surface del encoder muerto?")
            }
            onFrameEncodedTick(ptsNs / 1000L)
        } catch (t: Throwable) {
            Log.e(TAG, "Fallo renderizando frame", t)
            onError(t)
            return
        } finally {
            consumedFrames.incrementAndGet()
            // Devolver el slot al decoder pase lo que pase: evita deadlock.
            frameSlots.release()
        }
        maybeSignalEos()
    }

    /**
     * Transición whip-pan: rampa triangular de motion blur alrededor de cada
     * juntura de clips. La velocidad pico (0.35 UV) produce una estela de
     * ~1/3 de pantalla — el look de barrido de las transiciones pro.
     */
    private fun applyWhipPan(pipeline: FramePipelineRenderer, ptsUs: Long) {
        if (!directives.whipPanTransitions || directives.clipBoundariesUs.isEmpty()) return
        var magnitude = 0f
        for (boundary in directives.clipBoundariesUs) {
            val dist = kotlin.math.abs(ptsUs - boundary)
            if (dist < WHIP_WINDOW_US) {
                val m = WHIP_PEAK_UV * (1f - dist.toFloat() / WHIP_WINDOW_US)
                if (m > magnitude) magnitude = m
            }
        }
        pipeline.velocityNdc = floatArrayOf(magnitude, 0f)
    }

    /**
     * Subtítulos quemados: cuando cambia el subtítulo activo se rasteriza su
     * bitmap (texto blanco con contorno) y se sube como textura de overlay.
     * Costo amortizado: 1 rasterización por subtítulo, no por frame.
     */
    private fun applySubtitle(pipeline: FramePipelineRenderer, ptsMs: Long) {
        val subs = directives.subtitles
        if (subs.isEmpty()) return
        var newIndex = -1
        for (i in subs.indices) {
            if (ptsMs >= subs[i].startMs && ptsMs <= subs[i].endMs) {
                newIndex = i
                break
            }
            if (subs[i].startMs > ptsMs) break // ordenados: no seguir buscando
        }
        if (newIndex == activeSubtitleIndex) return
        activeSubtitleIndex = newIndex
        if (newIndex < 0) {
            pipeline.setOverlayBitmap(null)
        } else {
            pipeline.setOverlayBitmap(buildSubtitleBitmap(subs[newIndex].text))
        }
    }

    private fun buildSubtitleBitmap(text: String): android.graphics.Bitmap {
        val bmpWidth = width
        val bmpHeight = (height / 6).coerceAtLeast(64)
        val bitmap = android.graphics.Bitmap.createBitmap(
            bmpWidth, bmpHeight, android.graphics.Bitmap.Config.ARGB_8888
        )
        val canvas = android.graphics.Canvas(bitmap)

        val fill = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.WHITE
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            textAlign = android.graphics.Paint.Align.CENTER
            textSize = height * 0.05f
        }
        // Autoajuste: si el texto no cabe, reducir hasta encajar (mín. legible).
        var measured = fill.measureText(text)
        val maxWidth = bmpWidth * 0.94f
        if (measured > maxWidth) {
            fill.textSize = (fill.textSize * maxWidth / measured)
                .coerceAtLeast(height * 0.028f)
            measured = fill.measureText(text)
        }
        val stroke = android.graphics.Paint(fill).apply {
            style = android.graphics.Paint.Style.STROKE
            strokeWidth = fill.textSize * 0.14f
            color = android.graphics.Color.BLACK
        }

        val x = bmpWidth / 2f
        val y = bmpHeight * 0.62f
        canvas.drawText(text, x, y, stroke)
        canvas.drawText(text, x, y, fill)
        return bitmap
    }

    /** Invocado por el orquestador cuando el Hilo 1 terminó de volcar frames. */
    fun notifyDecoderFinished() {
        decoderDone.set(true)
        handler.post { maybeSignalEos() }
    }

    private fun maybeSignalEos() {
        if (!decoderDone.get() || eosSignalled.get()) return
        if (consumedFrames.get() >= renderedFrames.get()) {
            if (eosSignalled.compareAndSet(false, true)) {
                try {
                    encoder.signalEndOfInputStream()
                } catch (t: Throwable) {
                    onError(t)
                }
            }
        } else {
            // Quedan frames en tránsito en el BufferQueue; reintentar en breve.
            handler.postDelayed({ maybeSignalEos() }, EOS_POLL_MS)
        }
    }

    /** Libera todos los recursos GL EN el hilo GL y después mata el looper. */
    fun shutdown() {
        if (!isAlive) return
        val done = CountDownLatch(1)
        handler.post {
            try {
                surfaceTexture?.setOnFrameAvailableListener(null)
                decoderSurface?.release()
                surfaceTexture?.release()
                renderer?.release()
                windowSurface?.let { eglCore?.releaseSurface(it) }
                eglCore?.release()
            } catch (t: Throwable) {
                Log.w(TAG, "Error liberando recursos GL", t)
            } finally {
                renderer = null
                surfaceTexture = null
                decoderSurface = null
                windowSurface = null
                eglCore = null
                done.countDown()
            }
        }
        if (!done.await(3, TimeUnit.SECONDS)) {
            Log.w(TAG, "Timeout liberando GL; forzando quit")
        }
        quitSafely()
    }

    companion object {
        private const val TAG = "GlRenderThread"
        private const val EOS_POLL_MS = 5L
        private const val WHIP_WINDOW_US = 220_000L // ±220ms alrededor de la juntura
        private const val WHIP_PEAK_UV = 0.35f
    }
}
