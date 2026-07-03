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
 *   │ multi-clip    │             │ shaders + subs    │   encoder)  │ CBR + audio   │
 *   └──────────────┘             └──────────────────┘              └──────────────┘
 *          ▲                              │
 *          └── Semaphore(2) contrapresión ┘
 *
 * Soporta N clips en secuencia (PTS continuos), passthrough de audio AAC,
 * transiciones whip-pan con motion blur y subtítulos quemados en GPU.
 * Ningún píxel toca el heap de la app.
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
        var orphanEncoder: MediaCodec? = null
        var orphanMuxer: MediaMuxer? = null

        try {
            val sources = config.inputs
            require(sources.isNotEmpty()) { "Sin clips de entrada" }

            // ---------- Sondeo del primer clip: dimensiones/rotación ----------
            val probe = sources.first().openExtractor(context)
            val srcWidth: Int
            val srcHeight: Int
            val rotation: Int
            val probeDurationUs: Long
            try {
                val trackIndex = selectVideoTrack(probe)
                    ?: throw IllegalArgumentException("El primer clip no tiene pista de video")
                val fmt = probe.getTrackFormat(trackIndex)
                srcWidth = fmt.getInteger(MediaFormat.KEY_WIDTH)
                srcHeight = fmt.getInteger(MediaFormat.KEY_HEIGHT)
                rotation = if (fmt.containsKey(MediaFormat.KEY_ROTATION)) {
                    fmt.getInteger(MediaFormat.KEY_ROTATION)
                } else 0
                probeDurationUs = if (fmt.containsKey(MediaFormat.KEY_DURATION)) {
                    fmt.getLong(MediaFormat.KEY_DURATION)
                } else 0
            } finally {
                probe.release()
            }

            val declaredTotal = sources.sumOf { it.durationUs }
            durationUs = if (declaredTotal > 0) declaredTotal else probeDurationUs

            val outWidth = config.outputWidth ?: srcWidth
            val outHeight = config.outputHeight ?: srcHeight

            // ---------- Audio passthrough (opcional) ----------
            val audio = if (config.includeAudio) {
                AudioPassthrough.createOrNull(context, sources)
            } else null

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

            val muxer = if (config.outputFd != null) {
                // Salida directa a un FD de MediaStore: el resultado aparece en
                // la Galería sin permisos de almacenamiento heredados.
                MediaMuxer(config.outputFd, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            } else {
                MediaMuxer(
                    requireNotNull(config.outputPath) { "Se requiere outputPath u outputFd" },
                    MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4
                )
            }
            orphanMuxer = muxer

            // ---------- Directivas de render (transiciones + subtítulos) ----------
            val boundaries = if (sources.size > 1) {
                sources.dropLast(1)
                    .runningFold(0L) { acc, s -> acc + s.durationUs }
                    .drop(1)
            } else emptyList()

            val directives = RenderDirectives(
                clipBoundariesUs = boundaries,
                whipPanTransitions = config.whipPanTransitions,
                subtitles = config.burnSubtitles.sortedBy { it.startMs }
            )

            // ---------- HILO 2: contexto EGL ----------
            val gl = GlRenderThread(
                context = context,
                width = outWidth,
                height = outHeight,
                encoderInputSurface = encoderInputSurface,
                encoder = encoder,
                frameSlots = frameSlots,
                renderedFrames = renderedFrames,
                directives = directives,
                onFrameEncodedTick = { /* hook para HUD de progreso en vivo */ },
                onError = ::failOnce
            )
            glThread = gl
            gl.start()
            val decoderSurface = gl.awaitSurfaceReady()
            configureEffects?.invoke(gl)

            // ---------- HILO 1: decodificador multi-clip ----------
            val dec = DecoderThread(
                context = context,
                sources = sources,
                decoderSurface = decoderSurface,
                frameSlots = frameSlots,
                renderedFrames = renderedFrames,
                onDecoderFinished = { gl.notifyDecoderFinished() },
                onError = ::failOnce
            )
            decoderThread = dec

            // ---------- HILO 3: drenaje + audio ----------
            val drain = EncoderDrainThread(
                encoder = encoder,
                muxer = muxer,
                orientationDegrees = rotation,
                audio = audio,
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
            orphanEncoder = null
            orphanMuxer = null

            cont.invokeOnCancellation {
                finished.set(true)
                release()
            }
        } catch (t: Throwable) {
            Log.e(TAG, "Fallo arrancando el pipeline", t)
            // Liberar recursos que ningún hilo llegó a adoptar.
            try { orphanEncoder?.release() } catch (_: Throwable) { }
            try { orphanMuxer?.release() } catch (_: Throwable) { }
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
    val inputs: List<VideoSource>,
    val outputPath: String? = null,
    val outputFd: java.io.FileDescriptor? = null,
    val outputMime: String = "video/hevc",   // c2.exynos.hevc.encoder
    val bitrate: Int = 20_000_000,
    val frameRate: Int = 60,
    val outputWidth: Int? = null,
    val outputHeight: Int? = null,
    val whipPanTransitions: Boolean = false,
    val burnSubtitles: List<BurnSubtitle> = emptyList(),
    val includeAudio: Boolean = true
) {
    init {
        require(inputs.isNotEmpty()) { "Se requiere al menos un clip" }
        require(outputPath != null || outputFd != null) { "Se requiere outputPath u outputFd" }
    }
}
