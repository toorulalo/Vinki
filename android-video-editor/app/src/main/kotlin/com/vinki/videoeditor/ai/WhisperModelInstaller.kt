package com.vinki.videoeditor.ai

import android.content.Context
import android.util.Log
import java.io.File

/**
 * Instala el modelo whisper desde assets a filesDir (whisper.cpp necesita un
 * path real de filesystem, no un asset comprimido en el APK).
 *
 * El CI empaqueta ggml-base-q8_0.bin en assets/models/. Si el APK se compiló
 * sin él (build local sin descarga), [installedModelOrNull] devuelve null y
 * la UI muestra el ASR como no disponible — sin crashes.
 */
object WhisperModelInstaller {

    private const val TAG = "WhisperModelInstaller"
    private const val ASSET_PATH = "models/ggml-base-q8_0.bin"
    private const val LOCAL_NAME = "ggml-base-q8_0.bin"

    fun installedModelOrNull(context: Context): String? {
        val target = File(File(context.filesDir, "models").apply { mkdirs() }, LOCAL_NAME)
        if (target.exists() && target.length() > 0) return target.absolutePath

        return try {
            context.assets.open(ASSET_PATH).use { input ->
                val tmp = File(target.parentFile, "$LOCAL_NAME.part")
                tmp.outputStream().use { output -> input.copyTo(output, 1 shl 20) }
                if (!tmp.renameTo(target)) {
                    tmp.delete()
                    return null
                }
            }
            Log.i(TAG, "Modelo instalado en ${target.absolutePath} (${target.length() / (1 shl 20)}MB)")
            target.absolutePath
        } catch (t: Throwable) {
            Log.w(TAG, "Modelo whisper no disponible en assets", t)
            null
        }
    }
}
