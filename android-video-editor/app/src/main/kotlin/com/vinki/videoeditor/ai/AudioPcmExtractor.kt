package com.vinki.videoeditor.ai

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.util.Log
import kotlin.math.min

/**
 * Decodifica la pista de audio de un video a PCM mono float32 @16kHz — el
 * formato de entrada exacto de whisper.cpp.
 *
 * Pipeline: MediaCodec (AAC→PCM16 por hardware) → downmix mono (promedio de
 * canales) → remuestreo lineal incremental a 16kHz. El remuestreo es
 * streaming (estado de arrastre entre chunks): nunca se materializa el PCM
 * a la tasa original — un video de 10 min a 48kHz estéreo pasaría de ~230MB
 * a los ~38MB del buffer final de 16kHz.
 */
object AudioPcmExtractor {

    private const val TAG = "AudioPcmExtractor"
    private const val TARGET_RATE = 16_000
    private const val DEQUEUE_TIMEOUT_US = 10_000L

    /**
     * @param maxDurationSec techo duro de audio a transcribir (presupuesto de
     *        memoria y térmico). 10 min = ~38MB de floats.
     */
    fun extract(context: Context, uri: Uri, maxDurationSec: Int = 600): FloatArray {
        val extractor = MediaExtractor()
        var decoder: MediaCodec? = null
        try {
            extractor.setDataSource(context, uri, null)
            var trackIndex = -1
            var format: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val f = extractor.getTrackFormat(i)
                if (f.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
                    trackIndex = i
                    format = f
                    break
                }
            }
            val audioFormat = format
                ?: throw IllegalArgumentException("El video no tiene pista de audio")
            extractor.selectTrack(trackIndex)

            val mime = audioFormat.getString(MediaFormat.KEY_MIME)!!
            val codec = MediaCodec.createDecoderByType(mime)
            decoder = codec
            codec.configure(audioFormat, null, null, 0)
            codec.start()

            var srcRate = audioFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var channels = audioFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

            val out = FloatArray(TARGET_RATE * maxDurationSec)
            var outLen = 0

            // Estado del remuestreador lineal incremental.
            var srcConsumed = 0L      // muestras mono a srcRate ya vistas
            var nextSrcPos = 0.0      // posición (en muestras src) del próximo sample de salida
            var prevSample = 0f       // última muestra del chunk anterior (para interpolar en frontera)

            val info = MediaCodec.BufferInfo()
            var inputEos = false
            var outputEos = false

            while (!outputEos && outLen < out.size) {
                if (!inputEos) {
                    val inIdx = codec.dequeueInputBuffer(DEQUEUE_TIMEOUT_US)
                    if (inIdx >= 0) {
                        val buf = codec.getInputBuffer(inIdx)
                            ?: throw IllegalStateException("Input buffer nulo")
                        val size = extractor.readSampleData(buf, 0)
                        if (size < 0) {
                            codec.queueInputBuffer(
                                inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM
                            )
                            inputEos = true
                        } else {
                            codec.queueInputBuffer(inIdx, 0, size, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }

                val outIdx = codec.dequeueOutputBuffer(info, DEQUEUE_TIMEOUT_US)
                when {
                    outIdx == MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
                    outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val f = codec.outputFormat
                        srcRate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        Log.d(TAG, "PCM real: ${srcRate}Hz x$channels")
                    }
                    outIdx >= 0 -> {
                        if (info.size > 0) {
                            val byteBuf = codec.getOutputBuffer(outIdx)
                                ?: throw IllegalStateException("Output buffer nulo")
                            byteBuf.position(info.offset)
                            byteBuf.limit(info.offset + info.size)
                            val shorts = byteBuf.asShortBuffer()
                            val frames = shorts.remaining() / channels
                            if (frames > 0) {
                                // Downmix a mono en un chunk temporal pequeño.
                                val mono = FloatArray(frames)
                                for (fIdx in 0 until frames) {
                                    var acc = 0f
                                    for (c in 0 until channels) {
                                        acc += shorts.get(fIdx * channels + c) / 32768f
                                    }
                                    mono[fIdx] = acc / channels
                                }
                                // Remuestreo lineal incremental hacia `out`.
                                val step = srcRate.toDouble() / TARGET_RATE
                                val chunkStart = srcConsumed
                                val chunkEnd = srcConsumed + frames
                                while (nextSrcPos < chunkEnd - 1 && outLen < out.size) {
                                    if (nextSrcPos >= chunkStart) {
                                        val rel = nextSrcPos - chunkStart
                                        val i0 = rel.toInt()
                                        val frac = (rel - i0).toFloat()
                                        val s0 = if (i0 >= 0) mono[i0] else prevSample
                                        val s1 = mono[min(i0 + 1, frames - 1)]
                                        out[outLen++] = s0 + (s1 - s0) * frac
                                    }
                                    nextSrcPos += step
                                }
                                prevSample = mono[frames - 1]
                                srcConsumed = chunkEnd
                            }
                        }
                        codec.releaseOutputBuffer(outIdx, false)
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                            outputEos = true
                        }
                    }
                }
            }

            Log.i(TAG, "PCM extraído: ${outLen / TARGET_RATE}s @16kHz mono")
            return if (outLen == out.size) out else out.copyOf(outLen)
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
}
