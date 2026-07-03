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
    private val onFrameEncodedTick: (ptsUs: Long) -> Unit,
    private val onError: (Throwable) -> Unit
) : HandlerThread("Vinki-GlRender"), SurfaceTexture.OnFrameAvailableListener {

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
    }
}
