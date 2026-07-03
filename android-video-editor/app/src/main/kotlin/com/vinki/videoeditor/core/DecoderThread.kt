package com.vinki.videoeditor.core

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.util.Log
import android.view.Surface
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * HILO 1 — Extractor + Decodificador MULTI-CLIP.
 *
 * Decodifica la secuencia completa de la timeline: un extractor+decoder por
 * clip, en serie, volcando al MISMO Surface del Hilo 2. Los PTS de cada clip
 * se desplazan por la duración acumulada de los anteriores → la línea de
 * tiempo de salida es continua y las junturas coinciden con las fronteras
 * que usa el hilo GL para las transiciones whip-pan.
 *
 * Contrapresión: [frameSlots] (Semaphore(2)) limita frames en vuelo. Sin
 * esto, el decoder del Exynos (>300fps en 1080p) inundaría la memoria
 * gráfica compartida — OOM garantizado en clips 4K con 8GB de RAM.
 */
class DecoderThread(
    private val context: Context,
    private val sources: List<VideoSource>,
    private val decoderSurface: Surface,
    private val frameSlots: Semaphore,
    private val renderedFrames: AtomicLong,
    private val onDecoderFinished: () -> Unit,
    private val onError: (Throwable) -> Unit
) : Thread("Vinki-Decoder") {

    private val running = AtomicBoolean(true)

    fun requestStop() {
        running.set(false)
        interrupt()
    }

    override fun run() {
        var ptsOffsetUs = 0L
        try {
            for ((index, source) in sources.withIndex()) {
                if (!running.get()) break
                val lastPts = decodeOne(source, ptsOffsetUs)
                    ?: break // stop solicitado a mitad de clip
                // Offset del siguiente clip: duración declarada del clip
                // (coherente con las fronteras de la UI); respaldo al último
                // PTS real + 1 frame si la metadata mentía.
                ptsOffsetUs += if (source.durationUs > 0) {
                    source.durationUs
                } else {
                    (lastPts - ptsOffsetUs) + FALLBACK_FRAME_US
                }
                Log.d(TAG, "Clip $index decodificado; offset acumulado=${ptsOffsetUs}us")
            }
            onDecoderFinished()
        } catch (t: Throwable) {
            Log.e(TAG, "Fallo en el hilo decodificador", t)
            onError(t)
        }
    }

    /**
     * Decodifica un clip completo hacia el Surface. Devuelve el último PTS
     * ajustado renderizado, o null si se pidió stop. El extractor y el
     * decoder del clip se liberan SIEMPRE aquí (finally), clip a clip: la
     * huella de códecs HW es de exactamente 1 decoder en todo momento.
     */
    private fun decodeOne(source: VideoSource, ptsOffsetUs: Long): Long? {
        val extractor = source.openExtractor(context)
        var decoder: MediaCodec? = null
        val bufferInfo = MediaCodec.BufferInfo()
        var lastRenderedPts = ptsOffsetUs
        try {
            val trackIndex = selectVideoTrack(extractor)
                ?: throw IllegalArgumentException("Clip sin pista de video")
            extractor.selectTrack(trackIndex)
            val format = extractor.getTrackFormat(trackIndex)
            val mime = format.getString(MediaFormat.KEY_MIME)
                ?: throw IllegalArgumentException("Pista sin MIME")

            val codec = MediaCodec.createDecoderByType(mime)
            decoder = codec
            codec.configure(format, decoderSurface, null, 0)
            codec.start()

            var inputEos = false
            var outputEos = false
            while (!outputEos) {
                if (!running.get()) return null

                if (!inputEos) {
                    val inIndex = codec.dequeueInputBuffer(DEQUEUE_TIMEOUT_US)
                    if (inIndex >= 0) {
                        val inputBuffer = codec.getInputBuffer(inIndex)
                            ?: throw IllegalStateException("Input buffer nulo (index=$inIndex)")
                        val sampleSize = extractor.readSampleData(inputBuffer, 0)
                        if (sampleSize < 0) {
                            codec.queueInputBuffer(
                                inIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM
                            )
                            inputEos = true
                        } else {
                            codec.queueInputBuffer(
                                inIndex, 0, sampleSize, extractor.sampleTime, 0
                            )
                            extractor.advance()
                        }
                    }
                }

                val outIndex = codec.dequeueOutputBuffer(bufferInfo, DEQUEUE_TIMEOUT_US)
                when {
                    outIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
                    outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED ->
                        Log.d(TAG, "Formato decoder: ${codec.outputFormat}")
                    outIndex >= 0 -> {
                        val isEos =
                            bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                        if (bufferInfo.size > 0) {
                            if (!acquireSlotInterruptibly()) {
                                codec.releaseOutputBuffer(outIndex, false)
                                return null
                            }
                            val adjustedPtsUs = bufferInfo.presentationTimeUs + ptsOffsetUs
                            renderedFrames.incrementAndGet()
                            lastRenderedPts = adjustedPtsUs
                            // render=true con timestamp: el PTS ajustado viaja por
                            // el BufferQueue → surfaceTexture.timestamp en Hilo 2.
                            codec.releaseOutputBuffer(outIndex, adjustedPtsUs * 1000L)
                        } else {
                            codec.releaseOutputBuffer(outIndex, false)
                        }
                        if (isEos) outputEos = true
                    }
                }
            }
            return lastRenderedPts
        } finally {
            try {
                decoder?.stop()
            } catch (_: Throwable) { }
            try {
                decoder?.release()
            } catch (_: Throwable) { }
            try {
                extractor.release()
            } catch (_: Throwable) { }
        }
    }

    private fun acquireSlotInterruptibly(): Boolean {
        while (running.get()) {
            try {
                if (frameSlots.tryAcquire(SLOT_POLL_MS, TimeUnit.MILLISECONDS)) return true
            } catch (_: InterruptedException) {
                return false
            }
        }
        return false
    }

    private fun selectVideoTrack(extractor: MediaExtractor): Int? {
        for (i in 0 until extractor.trackCount) {
            val mime = extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: continue
            if (mime.startsWith("video/")) return i
        }
        return null
    }

    companion object {
        private const val TAG = "DecoderThread"
        private const val DEQUEUE_TIMEOUT_US = 10_000L
        private const val SLOT_POLL_MS = 100L
        private const val FALLBACK_FRAME_US = 33_333L
    }
}
