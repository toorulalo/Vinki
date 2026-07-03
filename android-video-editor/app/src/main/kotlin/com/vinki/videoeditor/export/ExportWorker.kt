package com.vinki.videoeditor.export

import android.app.Notification
import android.content.Context
import android.content.pm.ServiceInfo
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.FFmpegSession
import com.arthenica.ffmpegkit.ReturnCode
import com.vinki.videoeditor.VideoEditorApp
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import kotlin.coroutines.resume

/**
 * Background Worker de exportación headless.
 *
 * WorkManager + FGS tipo mediaProcessing (Android 15): el sistema concede
 * hasta 6 horas de CPU sin matar el proceso aunque el usuario salga de la
 * app; la notificación muestra progreso real (PTS muxeado / duración).
 *
 * La sesión FFmpeg corre en el pool nativo de ffmpeg-kit; la corrutina
 * suspende hasta el callback de finalización. Cancelar el Work cancela la
 * sesión FFmpeg (SIGINT interno) → el MFC del Exynos se libera al instante.
 */
class ExportWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val inputPath = inputData.getString(KEY_INPUT)
            ?: return Result.failure(errorData("Falta $KEY_INPUT"))
        val outputPath = inputData.getString(KEY_OUTPUT)
            ?: return Result.failure(errorData("Falta $KEY_OUTPUT"))
        val useHevc = inputData.getBoolean(KEY_USE_HEVC, true)
        val durationMs = inputData.getLong(KEY_DURATION_MS, 0L)

        try {
            setForeground(createForegroundInfo(0))
        } catch (t: Throwable) {
            // Sin FGS seguimos siendo un Work normal: degradación elegante.
            Log.w(TAG, "No se pudo promover a FGS mediaProcessing", t)
        }

        val spec = try {
            ExportSpec(
                inputPath = inputPath,
                outputPath = outputPath,
                codec = if (useHevc) HwCodec.HEVC else HwCodec.H264
            )
        } catch (e: IllegalArgumentException) {
            return Result.failure(errorData(e.message ?: "Spec inválida"))
        }

        val command = FfmpegCommandBuilder.build(spec)
        Log.i(TAG, "Ejecutando: ffmpeg $command")

        val session: FFmpegSession = suspendCancellableCoroutine { cont ->
            val ffmpegSession = FFmpegKit.executeAsync(
                command,
                { completed -> if (cont.isActive) cont.resume(completed) },
                { log -> Log.v(TAG, log.message ?: "") },
                { stats ->
                    if (durationMs > 0 && stats.time > 0) {
                        val progress = (stats.time.toFloat() / durationMs).coerceIn(0f, 1f)
                        setProgressAsync(
                            Data.Builder().putFloat(KEY_PROGRESS, progress).build()
                        )
                    }
                }
            )
            cont.invokeOnCancellation {
                FFmpegKit.cancel(ffmpegSession.sessionId)
            }
        }

        return when {
            ReturnCode.isSuccess(session.returnCode) -> {
                val out = File(outputPath)
                if (!out.exists() || out.length() == 0L) {
                    Result.failure(errorData("FFmpeg terminó OK pero la salida está vacía"))
                } else {
                    Result.success(
                        Data.Builder()
                            .putString(KEY_OUTPUT, outputPath)
                            .putLong(KEY_OUTPUT_BYTES, out.length())
                            .build()
                    )
                }
            }
            ReturnCode.isCancel(session.returnCode) -> {
                File(outputPath).delete() // no dejar MP4 truncados en disco
                Result.failure(errorData("Exportación cancelada"))
            }
            else -> {
                File(outputPath).delete()
                val tail = session.allLogsAsString?.takeLast(600) ?: "sin logs"
                Log.e(TAG, "FFmpeg falló (${session.returnCode}): $tail")
                Result.failure(errorData("FFmpeg falló: ${session.returnCode}"))
            }
        }
    }

    private fun createForegroundInfo(progressPct: Int): ForegroundInfo {
        val notification: Notification =
            Notification.Builder(applicationContext, VideoEditorApp.EXPORT_CHANNEL_ID)
                .setContentTitle("Exportando video")
                .setContentText("Codificación por hardware en curso…")
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setProgress(100, progressPct, progressPct == 0)
                .setOngoing(true)
                .build()
        return ForegroundInfo(
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING
        )
    }

    private fun errorData(message: String): Data =
        Data.Builder().putString(KEY_ERROR, message).build()

    companion object {
        private const val TAG = "ExportWorker"
        private const val NOTIFICATION_ID = 0x0E17

        const val KEY_INPUT = "input"
        const val KEY_OUTPUT = "output"
        const val KEY_USE_HEVC = "use_hevc"
        const val KEY_DURATION_MS = "duration_ms"
        const val KEY_PROGRESS = "progress"
        const val KEY_ERROR = "error"
        const val KEY_OUTPUT_BYTES = "output_bytes"
    }
}
