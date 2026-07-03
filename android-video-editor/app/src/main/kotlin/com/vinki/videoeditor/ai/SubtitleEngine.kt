package com.vinki.videoeditor.ai

import android.content.Context
import android.os.PowerManager
import android.util.Log
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.io.Closeable
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

/**
 * Subtitulado ASR editable sobre whisper.cpp — MODO BATCH ESTRICTO.
 *
 * El audio se trocea en lotes INDEPENDIENTES y NO SOLAPADOS de 10 segundos.
 * Queda prohibido el sliding window: whisper es un transformer no-causal
 * (cada token atiende sobre todo el espectrograma del lote), así que una
 * ventana deslizante re-infiere audio ya procesado — tokens duplicados en las
 * costuras y ~3x de trabajo en los Cortex-A78 para el mismo resultado.
 *
 * Estrategia térmica (Exynos 1380, ~5W sostenidos):
 *  - 4 hilos de inferencia (solo los A78; los A55 no aportan en GEMM int8).
 *  - Entre lotes se consulta PowerManager.thermalHeadroom; si el SoC va
 *    camino de throttling se inserta una pausa — mejor 1.2x de tiempo total
 *    que un cliff térmico que baje los A78 a 1.4GHz y lo haga 3x.
 */
class SubtitleEngine(
    context: Context,
    private val modelPath: String,
    private val language: String = "auto"
) : Closeable {

    private val powerManager =
        context.applicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager

    // Un solo hilo: whisper_context no es reentrante y dos inferencias
    // paralelas duplicarían la presión térmica sin ganar throughput.
    private val serialExecutor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "Vinki-Whisper").apply { priority = Thread.NORM_PRIORITY - 1 }
    }
    private val whisperDispatcher: CoroutineDispatcher = serialExecutor.asCoroutineDispatcher()

    private val subtitleIds = AtomicLong(0)

    @Volatile
    private var handle: Long = 0L

    @Volatile
    private var closed = false

    private fun ensureLoaded(): Long {
        check(!closed) { "SubtitleEngine ya cerrado" }
        if (handle == 0L) {
            synchronized(this) {
                if (handle == 0L && !closed) {
                    handle = WhisperBridge.nativeInit(modelPath, N_THREADS)
                    check(handle != 0L) { "No se pudo inicializar whisper ($modelPath)" }
                }
            }
        }
        return handle
    }

    /**
     * Transcribe una pista completa de PCM mono float32 @16kHz y emite
     * subtítulos editables por lote, en orden temporal. Cold-flow: cancelar
     * el colector aborta entre lotes (nunca a mitad de una inferencia).
     */
    fun transcribe(pcm: FloatArray): Flow<EditableSubtitle> = flow {
        require(pcm.isNotEmpty()) { "PCM vacío" }
        val h = ensureLoaded()

        var offset = 0
        var batchIndex = 0
        while (offset < pcm.size) {
            // Barrera contra use-after-free: close() marca `closed` ANTES de
            // encolar el release en este mismo dispatcher serial, así que si
            // llegamos aquí con closed=true el handle sigue siendo válido pero
            // está a punto de morir — abortar sin tocar nativo.
            check(!closed) { "SubtitleEngine cerrado durante la transcripción" }
            awaitThermalHeadroom()

            val end = minOf(offset + BATCH_SAMPLES, pcm.size)
            val batch = pcm.copyOfRange(offset, end)
            val batchStartMs = (offset.toLong() * 1000L) / SAMPLE_RATE

            val segments = try {
                WhisperBridge.nativeTranscribe(h, batch, language)
            } catch (t: Throwable) {
                Log.e(TAG, "Fallo transcribiendo lote $batchIndex", t)
                throw SubtitleException("Lote $batchIndex falló", t)
            }

            for (seg in segments) {
                val text = seg.text.trim()
                if (text.isEmpty()) continue
                emit(
                    EditableSubtitle(
                        id = subtitleIds.incrementAndGet(),
                        startMs = batchStartMs + seg.startMs,
                        endMs = batchStartMs + seg.endMs,
                        text = text
                    )
                )
            }

            offset = end
            batchIndex++
        }
    }.flowOn(whisperDispatcher)

    /**
     * Pausa cooperativa si el SoC está cerca del límite térmico.
     * thermalHeadroom(10s): 1.0 = throttling severo inminente.
     */
    private suspend fun awaitThermalHeadroom() {
        var waits = 0
        while (waits < MAX_THERMAL_WAITS) {
            val headroom = try {
                powerManager.getThermalHeadroom(THERMAL_FORECAST_SECONDS)
            } catch (_: Throwable) {
                return // API no soportada: continuar sin guardia
            }
            if (headroom.isNaN() || headroom < THERMAL_THRESHOLD) return
            Log.w(TAG, "Headroom térmico $headroom ≥ $THERMAL_THRESHOLD; pausando ASR 5s")
            delay(5_000)
            waits++
        }
    }

    override fun close() {
        if (closed) return
        closed = true
        // El release se encola en el MISMO dispatcher serial: si hay una
        // inferencia en vuelo, corre después de ella — nunca use-after-free.
        serialExecutor.execute {
            if (handle != 0L) {
                try {
                    WhisperBridge.nativeRelease(handle)
                } catch (t: Throwable) {
                    Log.w(TAG, "Error liberando contexto whisper", t)
                } finally {
                    handle = 0L
                }
            }
        }
        serialExecutor.shutdown()
    }

    companion object {
        private const val TAG = "SubtitleEngine"
        const val SAMPLE_RATE = 16_000
        const val BATCH_SECONDS = 10
        const val BATCH_SAMPLES = SAMPLE_RATE * BATCH_SECONDS
        private const val N_THREADS = 4
        private const val THERMAL_FORECAST_SECONDS = 10
        private const val THERMAL_THRESHOLD = 0.90f
        private const val MAX_THERMAL_WAITS = 24 // techo de 2 min de espera
    }
}

/**
 * Subtítulo editable: [text] es la salida ASR original (inmutable, permite
 * "restaurar"); [editedText] es lo que el usuario corrigió en la UI.
 */
data class EditableSubtitle(
    val id: Long,
    val startMs: Long,
    val endMs: Long,
    val text: String,
    val editedText: String? = null
) {
    val displayText: String get() = editedText ?: text
}

class SubtitleException(message: String, cause: Throwable? = null) : Exception(message, cause)
