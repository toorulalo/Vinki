package com.vinki.videoeditor.core

import android.media.MediaCodec
import android.media.MediaExtractor
import android.util.Log
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * HILO 1 — Extractor + Decodificador.
 *
 * Bucle síncrono clásico (patrón grafika): alimenta el MediaCodec decoder con
 * samples del MediaExtractor y vuelca cada frame decodificado al Surface del
 * SurfaceTexture del Hilo 2 mediante releaseOutputBuffer(index, ptsNs).
 *
 * Contrapresión ("backpressure"): [frameSlots] limita a N frames en vuelo.
 * Sin esto, un decoder AVC del Exynos a >300fps de decodificación inundaría el
 * BufferQueue y dispararía picos de memoria gráfica — con 8GB compartidos
 * entre CPU/GPU eso es un OOM-kill garantizado en clips 4K. El permiso se
 * devuelve en el Hilo 2 tras updateTexImage().
 */
class DecoderThread(
    private val extractor: MediaExtractor,
    private val decoder: MediaCodec,
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
        val bufferInfo = MediaCodec.BufferInfo()
        var inputEos = false
        var outputEos = false

        try {
            decoder.start()
            while (!outputEos && running.get()) {
                // ---- Entrada: extractor → decoder ----
                if (!inputEos) {
                    val inIndex = decoder.dequeueInputBuffer(DEQUEUE_TIMEOUT_US)
                    if (inIndex >= 0) {
                        val inputBuffer = decoder.getInputBuffer(inIndex)
                            ?: throw IllegalStateException("Input buffer nulo (index=$inIndex)")
                        val sampleSize = extractor.readSampleData(inputBuffer, 0)
                        if (sampleSize < 0) {
                            decoder.queueInputBuffer(
                                inIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM
                            )
                            inputEos = true
                        } else {
                            decoder.queueInputBuffer(
                                inIndex, 0, sampleSize, extractor.sampleTime, 0
                            )
                            extractor.advance()
                        }
                    }
                }

                // ---- Salida: decoder → Surface (Hilo 2) ----
                val outIndex = decoder.dequeueOutputBuffer(bufferInfo, DEQUEUE_TIMEOUT_US)
                when {
                    outIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
                    outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED ->
                        Log.d(TAG, "Formato de salida del decoder: ${decoder.outputFormat}")
                    outIndex >= 0 -> {
                        val isEos = bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                        val hasFrame = bufferInfo.size > 0

                        if (hasFrame) {
                            // Bloquea hasta que el Hilo 2 libere un slot, pero de
                            // forma interrumpible para que el shutdown nunca deadlockee.
                            if (!acquireSlotInterruptibly()) {
                                decoder.releaseOutputBuffer(outIndex, false)
                                break
                            }
                            renderedFrames.incrementAndGet()
                            // render=true con timestamp: el PTS viaja por el BufferQueue
                            // y reaparece en surfaceTexture.timestamp en el Hilo 2.
                            decoder.releaseOutputBuffer(
                                outIndex, bufferInfo.presentationTimeUs * 1000L
                            )
                        } else {
                            decoder.releaseOutputBuffer(outIndex, false)
                        }
                        if (isEos) outputEos = true
                    }
                }
            }
            onDecoderFinished()
        } catch (ie: InterruptedException) {
            Log.d(TAG, "Decoder interrumpido durante shutdown")
        } catch (t: Throwable) {
            Log.e(TAG, "Fallo en el hilo decodificador", t)
            onError(t)
        } finally {
            try {
                decoder.stop()
            } catch (_: Throwable) { /* ya detenido o en estado de error */ }
            try {
                decoder.release()
            } catch (_: Throwable) { }
            try {
                extractor.release()
            } catch (_: Throwable) { }
        }
    }

    private fun acquireSlotInterruptibly(): Boolean {
        while (running.get()) {
            if (frameSlots.tryAcquire(SLOT_POLL_MS, TimeUnit.MILLISECONDS)) return true
        }
        return false
    }

    companion object {
        private const val TAG = "DecoderThread"
        private const val DEQUEUE_TIMEOUT_US = 10_000L
        private const val SLOT_POLL_MS = 100L
    }
}
