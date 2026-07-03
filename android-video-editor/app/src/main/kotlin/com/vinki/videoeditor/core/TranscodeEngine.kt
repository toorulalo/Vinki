package com.vinki.videoeditor.core

import android.content.Context
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.Semaphore
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Orquestador del pipeline zero-copy de 3 hilos (Exynos 1380):
 *
 *   ┌──────────────┐   Surface    ┌──────────────────┐  EGLSurface  ┌──────────────┐
 *   │ HILO 1        │ ───────────▶│ HILO 2            │ ───────────▶│ HILO 3        │
 *   │ Extractor +   │  (dmabuf,   │ EGL/GLES3         │  (input-    │ Encoder drain │
 *   │ Decoder       │  BufferQ.)  │ OES + transform + │   surface   │ → MediaMuxer  │
 *   │ (c2.exynos)   │             │ shaders           │   encoder)  │ CBR           │
 *   └──────────────┘             └──────────────────┘              └──────────────┘
 *          ▲                              │
 *          └── Semaphore(2) contrapresión ┘
 *
 * Ningún píxel toca el heap de la app: decoder → SurfaceTexture (OES) →
 * FBO → input-surface del encoder, todo en memoria gráfica compartida.
 */
class TranscodeEngine(
    private val context: Context,
    private val config: TranscodeConfig
) {
    private val error = AtomicReference<Throwable?>(null)
    private val released = AtomicBoolean(false)
    private val renderedFrames = AtomicLong(0)
    private val frameSlots = Semaphore(MAX_FRAMES_IN_FLIGHT)

    private var decoderThread: DecoderThread? = null
    private var glThread: GlRenderThread? = null
    private var drainThread: EncoderDrainThread? = null

    /** PTS (µs) del último sample muxeado — para UI de progreso. */
    val progressUs = AtomicLong(0)
    var durationUs: Long = 0
        private set

    /**
     * Ejecuta la transcodificación completa. Suspende hasta EOS o error;
     * cancelar la corrutina detiene y libera los 3 hilos limpiamente.
     */
    suspend fun run(
        configureEffects: ((GlRenderThread) -> Unit)? = null
    ): Unit = suspendCancellableCoroutine { cont ->
        val finished = AtomicBoolean(false)

        fun failOnce(t: Throwable) {
            if (error.compareAndSet(null, t) && finished.compareAndSet(false, true)) {
                release()
                if (cont.isActive) cont.resumeWithException(t)
            }
        }

        // Recursos que aún no fueron adoptados por un hilo propietario: si el
        // arranque falla a mitad, el catch los libera para no fugar códecs HW
        // (el Exynos tiene un número finito de instancias de MFC).
        var orphanExtractor: MediaExtractor? = null
        var orphanEncoder: MediaCodec? = null
        var orphanMuxer: MediaMuxer? = null
        var orphanDecoder: MediaCodec? = null

        try {
            // ---------- Origen ----------
            val extractor = MediaExtractor()
            orphanExtractor = extractor
            extractor.setDataSource(config.inputPath)
            val trackIndex = selectVideoTrack(extractor)
                ?: throw IllegalArgumentException("Sin pista de video en ${config.inputPath}")
            extractor.selectTrack(trackIndex)
            val inputFormat = extractor.getTrackFormat(trackIndex)

            val srcWidth = inputFormat.getInteger(MediaFormat.KEY_WIDTH)
            val srcHeight = inputFormat.getInteger(MediaFormat.KEY_HEIGHT)
            val rotation = if (inputFormat.containsKey(MediaFormat.KEY_ROTATION)) {
                inputFormat.getInteger(MediaFormat.KEY_ROTATION)
            } else 0
            durationUs = if (inputFormat.containsKey(MediaFormat.KEY_DURATION)) {
                inputFormat.getLong(MediaFormat.KEY_DURATION)
            } else 0

            val outWidth = config.outputWidth ?: srcWidth
            val outHeight = config.outputHeight ?: srcHeight

            // ---------- Encoder (HILO 3) — CBR explícito ----------
            val encoderFormat = MediaFormat.createVideoFormat(
                config.outputMime, outWidth, outHeight
            ).apply {
                setInteger(
                    MediaFormat.KEY_COLOR_FORMAT,
                    MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface
                )
                setInteger(MediaFormat.KEY_BIT_RATE, config.bitrate)
                // CBR: caudal constante. Elude la heurística "VMAF quality floor"
                // que en modo VBR degrada bitrate en escenas estáticas y produce
                // pumping de calidad en material de screencast/pantalla verde.
                setInteger(
                    MediaFormat.KEY_BITRATE_MODE,
                    MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR
                )
                setInteger(MediaFormat.KEY_FRAME_RATE, config.frameRate)
                setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
                setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
                // Prioridad realtime del códec HW: latencia mínima del MFC.
                setInteger(MediaFormat.KEY_PRIORITY, 0)
            }
            val encoder = MediaCodec.createEncoderByType(config.outputMime)
            orphanEncoder = encoder
            encoder.configure(encoderFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            val encoderInputSurface = encoder.createInputSurface()
            encoder.start()

            val muxer = MediaMuxer(
                config.outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4
            )
            orphanMuxer = muxer

            // ---------- HILO 2: contexto EGL ----------
            val gl = GlRenderThread(
                context = context,
                width = outWidth,
                height = outHeight,
                encoderInputSurface = encoderInputSurface,
                encoder = encoder,
                frameSlots = frameSlots,
                renderedFrames = renderedFrames,
                onFrameEncodedTick = { /* hook para HUD de progreso en vivo */ },
                onError = ::failOnce
            )
            glThread = gl
            gl.start()
            val decoderSurface = gl.awaitSurfaceReady()
            configureEffects?.invoke(gl)

            // ---------- HILO 1: decoder sobre el Surface del Hilo 2 ----------
            val decoder = MediaCodec.createDecoderByType(
                inputFormat.getString(MediaFormat.KEY_MIME)
                    ?: throw IllegalArgumentException("Pista sin MIME")
            )
            orphanDecoder = decoder
            decoder.configure(inputFormat, decoderSurface, null, 0)

            val dec = DecoderThread(
                extractor = extractor,
                decoder = decoder,
                frameSlots = frameSlots,
                renderedFrames = renderedFrames,
                onDecoderFinished = { gl.notifyDecoderFinished() },
                onError = ::failOnce
            )
            decoderThread = dec

            // ---------- HILO 3: drenaje ----------
            val drain = EncoderDrainThread(
                encoder = encoder,
                muxer = muxer,
                orientationDegrees = rotation,
                onProgress = { pts -> progressUs.set(pts) },
                onFinished = {
                    if (finished.compareAndSet(false, true)) {
                        release()
                        if (cont.isActive) cont.resume(Unit)
                    }
                },
                onError = ::failOnce
            )
            drainThread = drain

            // A partir de aquí cada hilo es dueño de sus recursos y los libera
            // en su propio finally: los huérfanos dejan de serlo.
            drain.start()
            dec.start()
            orphanExtractor = null
            orphanEncoder = null
            orphanMuxer = null
            orphanDecoder = null

            cont.invokeOnCancellation {
                finished.set(true)
                release()
            }
        } catch (t: Throwable) {
            Log.e(TAG, "Fallo arrancando el pipeline", t)
            // Liberar recursos que ningún hilo llegó a adoptar.
            try { orphanDecoder?.release() } catch (_: Throwable) { }
            try { orphanEncoder?.release() } catch (_: Throwable) { }
            try { orphanMuxer?.release() } catch (_: Throwable) { }
            try { orphanExtractor?.release() } catch (_: Throwable) { }
            failOnce(t)
        }
    }

    /** Idempotente y seguro desde cualquier hilo. */
    fun release() {
        if (!released.compareAndSet(false, true)) return
        try {
            decoderThread?.requestStop()
        } catch (_: Throwable) { }
        try {
            drainThread?.requestStop()
        } catch (_: Throwable) { }
        try {
            glThread?.shutdown()
        } catch (_: Throwable) { }
        decoderThread = null
        drainThread = null
        glThread = null
    }

    private fun selectVideoTrack(extractor: MediaExtractor): Int? {
        for (i in 0 until extractor.trackCount) {
            val mime = extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: continue
            if (mime.startsWith("video/")) return i
        }
        return null
    }

    companion object {
        private const val TAG = "TranscodeEngine"

        /**
         * 2 frames en vuelo: doble-buffer real. Más permite jitter, menos
         * serializa decoder↔GPU. Con 2, la ocupación pico de memoria gráfica
         * del pipeline queda acotada a ~2 × (W×H×1.5) bytes NV12 + 1 FBO RGBA.
         */
        private const val MAX_FRAMES_IN_FLIGHT = 2
    }
}

data class TranscodeConfig(
    val inputPath: String,
    val outputPath: String,
    val outputMime: String = "video/hevc",   // c2.exynos.hevc.encoder
    val bitrate: Int = 20_000_000,
    val frameRate: Int = 60,
    val outputWidth: Int? = null,
    val outputHeight: Int? = null
)
