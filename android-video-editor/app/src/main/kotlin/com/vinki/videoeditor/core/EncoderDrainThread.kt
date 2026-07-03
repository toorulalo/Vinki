package com.vinki.videoeditor.core

import android.media.MediaCodec
import android.media.MediaMuxer
import android.util.Log
import java.util.concurrent.atomic.AtomicBoolean

/**
 * HILO 3 — Drenaje del encoder → MediaMuxer.
 *
 * El encoder recibe sus frames por su input-surface (los pinta el Hilo 2);
 * este hilo solo drena la salida comprimida. El muxer NO puede arrancar hasta
 * INFO_OUTPUT_FORMAT_CHANGED (ahí llegan SPS/PPS/VPS); escribir antes produce
 * un MP4 irreproducible.
 */
class EncoderDrainThread(
    private val encoder: MediaCodec,
    private val muxer: MediaMuxer,
    private val orientationDegrees: Int,
    private val audio: AudioPassthrough?,
    private val onProgress: (ptsUs: Long) -> Unit,
    private val onFinished: () -> Unit,
    private val onError: (Throwable) -> Unit
) : Thread("Vinki-EncoderDrain") {

    private val running = AtomicBoolean(true)
    private var muxerStarted = false
    private var videoTrackIndex = -1
    private var audioTrackIndex = -1

    fun requestStop() {
        running.set(false)
        interrupt()
    }

    override fun run() {
        val bufferInfo = MediaCodec.BufferInfo()
        try {
            while (running.get()) {
                val outIndex = encoder.dequeueOutputBuffer(bufferInfo, DEQUEUE_TIMEOUT_US)
                when {
                    outIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> Unit

                    outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        check(!muxerStarted) { "Formato cambió con el muxer ya arrancado" }
                        val format = encoder.outputFormat
                        videoTrackIndex = muxer.addTrack(format)
                        // Todas las pistas deben añadirse ANTES de start().
                        if (audio != null) {
                            audioTrackIndex = muxer.addTrack(audio.outputFormat)
                        }
                        // La rotación del contenedor complementa a la matriz de
                        // hardware del Hilo 2: metadatos de orientación del origen.
                        muxer.setOrientationHint(orientationDegrees)
                        muxer.start()
                        muxerStarted = true
                        Log.d(TAG, "Muxer arrancado con formato: $format")
                    }

                    outIndex >= 0 -> {
                        val encodedData = encoder.getOutputBuffer(outIndex)
                            ?: throw IllegalStateException("Output buffer nulo (index=$outIndex)")

                        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                            // CSD ya entregado vía outputFormat; no se muxea dos veces.
                            bufferInfo.size = 0
                        }

                        if (bufferInfo.size > 0) {
                            check(muxerStarted) { "Sample de video antes del FORMAT_CHANGED" }
                            encodedData.position(bufferInfo.offset)
                            encodedData.limit(bufferInfo.offset + bufferInfo.size)
                            muxer.writeSampleData(videoTrackIndex, encodedData, bufferInfo)
                            onProgress(bufferInfo.presentationTimeUs)
                        }

                        encoder.releaseOutputBuffer(outIndex, false)

                        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                            Log.d(TAG, "EOS del encoder alcanzado")
                            // Passthrough de audio tras el video: el muxer
                            // interlava por PTS al finalizar. Si falla, el video
                            // se entrega igualmente (sin audio) — nunca se pierde.
                            if (audio != null && audioTrackIndex >= 0) {
                                try {
                                    audio.writeAllSamples(muxer, audioTrackIndex)
                                } catch (t: Throwable) {
                                    Log.e(TAG, "Passthrough de audio falló", t)
                                }
                            }
                            onFinished()
                            return
                        }
                    }
                }
            }
        } catch (ie: InterruptedException) {
            Log.d(TAG, "Drenaje interrumpido durante shutdown")
        } catch (t: Throwable) {
            Log.e(TAG, "Fallo en el hilo de drenaje del encoder", t)
            onError(t)
        } finally {
            try {
                encoder.stop()
            } catch (_: Throwable) { }
            try {
                encoder.release()
            } catch (_: Throwable) { }
            try {
                if (muxerStarted) muxer.stop()
                muxer.release()
            } catch (t: Throwable) {
                Log.w(TAG, "Error cerrando muxer (posible salida truncada)", t)
            }
        }
    }

    companion object {
        private const val TAG = "EncoderDrainThread"
        private const val DEQUEUE_TIMEOUT_US = 10_000L
    }
}
