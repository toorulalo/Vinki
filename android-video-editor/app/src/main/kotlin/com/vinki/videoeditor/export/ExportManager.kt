package com.vinki.videoeditor.export

import android.content.Context
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkInfo
import androidx.work.WorkManager
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID

/**
 * Fachada de exportación: encola el [ExportWorker] como trabajo expedito
 * único (una exportación a la vez — el MFC del Exynos no multiplexa bien
 * dos sesiones de encode) y expone el progreso como Flow para la UI.
 */
object ExportManager {

    private const val UNIQUE_WORK = "vinki-export"

    fun enqueue(
        context: Context,
        inputUris: List<String>,
        durationsMs: List<Long>,
        chromaKey: Boolean,
        whipPan: Boolean,
        subtitlesJsonPath: String?
    ): UUID {
        require(inputUris.isNotEmpty() && inputUris.size == durationsMs.size) {
            "Clips y duraciones inconsistentes"
        }
        val request = OneTimeWorkRequestBuilder<ExportWorker>()
            .setInputData(
                Data.Builder()
                    .putStringArray(ExportWorker.KEY_INPUT_URIS, inputUris.toTypedArray())
                    .putLongArray(ExportWorker.KEY_DURATIONS_MS, durationsMs.toLongArray())
                    .putBoolean(ExportWorker.KEY_CHROMA_KEY, chromaKey)
                    .putBoolean(ExportWorker.KEY_WHIP_PAN, whipPan)
                    .putString(ExportWorker.KEY_SUBS_JSON, subtitlesJsonPath)
                    .build()
            )
            // Expedito: arranca ya; si no hay cuota, cae a Work normal.
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .setConstraints(
                Constraints.Builder()
                    .setRequiresStorageNotLow(true)
                    .build()
            )
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork(UNIQUE_WORK, ExistingWorkPolicy.REPLACE, request)
        return request.id
    }

    /** Progreso [0,1] y estado terminal de la exportación en curso. */
    fun progress(context: Context, id: UUID): Flow<ExportProgress> =
        WorkManager.getInstance(context).getWorkInfoByIdFlow(id).map { info ->
            when (info?.state) {
                WorkInfo.State.SUCCEEDED -> ExportProgress.Done(
                    outputUri = info.outputData.getString(ExportWorker.KEY_OUTPUT_URI).orEmpty()
                )
                WorkInfo.State.FAILED -> ExportProgress.Failed(
                    reason = info.outputData.getString(ExportWorker.KEY_ERROR) ?: "desconocido"
                )
                WorkInfo.State.CANCELLED -> ExportProgress.Failed("cancelado")
                else -> ExportProgress.Running(
                    fraction = info?.progress?.getFloat(ExportWorker.KEY_PROGRESS, 0f) ?: 0f
                )
            }
        }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_WORK)
    }
}

sealed interface ExportProgress {
    data class Running(val fraction: Float) : ExportProgress
    data class Done(val outputUri: String) : ExportProgress
    data class Failed(val reason: String) : ExportProgress
}
