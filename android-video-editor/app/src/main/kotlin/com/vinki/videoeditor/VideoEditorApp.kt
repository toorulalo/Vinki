package com.vinki.videoeditor

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.StrictMode

class VideoEditorApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // Canal de la notificación del FGS de exportación (mediaProcessing).
        val manager = getSystemService(NotificationManager::class.java)
        manager?.createNotificationChannel(
            NotificationChannel(
                EXPORT_CHANNEL_ID,
                "Exportación de video",
                NotificationManager.IMPORTANCE_LOW
            )
        )

        // Agente de auto-depuración en debug: cualquier I/O en el hilo de UI,
        // leak de Closeable o de registro se reporta en el acto.
        if (BuildConfig.DEBUG) {
            StrictMode.setThreadPolicy(
                StrictMode.ThreadPolicy.Builder()
                    .detectAll()
                    .penaltyLog()
                    .build()
            )
            StrictMode.setVmPolicy(
                StrictMode.VmPolicy.Builder()
                    .detectLeakedClosableObjects()
                    .detectLeakedRegistrationObjects()
                    .detectActivityLeaks()
                    .penaltyLog()
                    .build()
            )
        }
    }

    companion object {
        const val EXPORT_CHANNEL_ID = "vinki_export"
    }
}
