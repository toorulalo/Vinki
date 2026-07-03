package com.vinki.videoeditor.export

import android.app.Notification
import android.content.ContentValues
import android.content.Context
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import com.vinki.videoeditor.VideoEditorApp
import com.vinki.videoeditor.core.ChromaKeyConfig
import com.vinki.videoeditor.core.TranscodeConfig
import com.vinki.videoeditor.core.TranscodeEngine
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Background Worker de exportación headless.
 *
 * WorkManager + FGS tipo mediaProcessing (Android 15): el sistema concede
 * hasta 6 horas de proceso multimedia sin matar la app aunque el usuario
 * salga de ella.
 *
 * La codificación corre en el motor nativo de 3 hilos (TranscodeEngine):
 * encode físico HEVC/AVC en el MFC del Exynos 1380, en modo CBR, sin
 * binarios externos. El resultado se escribe directamente en MediaStore
 * (Movies/Vinki) vía FileDescriptor — aparece en la Galería al terminar.
 */
class ExportWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val inputUriStr = inputData.getString(KEY_INPUT_URI)
            ?: return Result.failure(errorData("Falta $KEY_INPUT_URI"))
        val chromaKey = inputData.getBoolean(KEY_CHROMA_KEY, false)

        try {
            setForeground(createForegroundInfo())
        } catch (t: Throwable) {
            // Sin FGS seguimos siendo un Work normal: degradación elegante.
            Log.w(TAG, "No se pudo promover a FGS mediaProcessing", t)
        }

        val resolver = applicationContext.contentResolver
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val values = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, "vinki_export_$stamp.mp4")
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            put(
                MediaStore.Video.Media.RELATIVE_PATH,
                Environment.DIRECTORY_MOVIES + "/Vinki"
            )
            put(MediaStore.Video.Media.IS_PENDING, 1)
        }
        val itemUri = resolver.insert(
            MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
            values
        ) ?: return Result.failure(errorData("MediaStore rechazó la inserción"))

        var engine: TranscodeEngine? = null
        return try {
            resolver.openFileDescriptor(itemUri, "rw")?.use { pfd ->
                val transcoder = TranscodeEngine(
                    applicationContext,
                    TranscodeConfig(
                        inputUri = Uri.parse(inputUriStr),
                        outputFd = pfd.fileDescriptor
                    )
                )
                engine = transcoder

                coroutineScope {
                    val poller = launch {
                        while (isActive) {
                            val duration = transcoder.durationUs
                            if (duration > 0) {
                                val fraction = (transcoder.progressUs.get().toFloat() / duration)
                                    .coerceIn(0f, 1f)
                                setProgress(
                                    Data.Builder().putFloat(KEY_PROGRESS, fraction).build()
                                )
                            }
                            delay(500)
                        }
                    }
                    try {
                        transcoder.run(
                            configureEffects = if (chromaKey) {
                                { gl -> gl.post { it.chromaKeyConfig = ChromaKeyConfig() } }
                            } else null
                        )
                    } finally {
                        poller.cancel()
                    }
                }
            } ?: return Result.failure(errorData("No se pudo abrir FD de salida"))

            // Publicar en la Galería: quitar IS_PENDING.
            values.clear()
            values.put(MediaStore.Video.Media.IS_PENDING, 0)
            resolver.update(itemUri, values, null, null)

            Result.success(
                Data.Builder().putString(KEY_OUTPUT_URI, itemUri.toString()).build()
            )
        } catch (t: Throwable) {
            Log.e(TAG, "Exportación fallida", t)
            // No dejar entradas pendientes fantasma en MediaStore.
            try {
                resolver.delete(itemUri, null, null)
            } catch (_: Throwable) { }
            Result.failure(errorData(t.message ?: "Error desconocido"))
        } finally {
            try {
                engine?.release()
            } catch (_: Throwable) { }
        }
    }

    private fun createForegroundInfo(): ForegroundInfo {
        val notification: Notification =
            Notification.Builder(applicationContext, VideoEditorApp.EXPORT_CHANNEL_ID)
                .setContentTitle("Exportando video")
                .setContentText("Codificación por hardware en curso…")
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setProgress(100, 0, true)
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

        const val KEY_INPUT_URI = "input_uri"
        const val KEY_CHROMA_KEY = "chroma_key"
        const val KEY_PROGRESS = "progress"
        const val KEY_ERROR = "error"
        const val KEY_OUTPUT_URI = "output_uri"
    }
}
