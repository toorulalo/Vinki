package com.vinki.videoeditor.ui

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import android.widget.VideoView
import com.vinki.videoeditor.export.ExportManager
import com.vinki.videoeditor.export.ExportProgress
import com.vinki.videoeditor.timeline.ClipNode
import com.vinki.videoeditor.timeline.MagneticTrack
import com.vinki.videoeditor.timeline.TimelineGraph
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Editor mínimo funcional:
 *
 *   [ Previsualización (VideoView) ]
 *   [ + Video ] [ Chroma key ⭘ ] [ Exportar ]
 *   [ estado ]
 *   [ Timeline magnética 90Hz ]
 *
 * Flujo: elegir video (SAF) → aparece en la timeline y se previsualiza →
 * opcional chroma key → Exportar corre el motor de 3 hilos (HEVC CBR en el
 * MFC) en un Worker FGS y el resultado aparece en Galería (Movies/Vinki).
 */
class EditorActivity : Activity() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var progressJob: Job? = null

    private lateinit var timeline: TimelineView
    private lateinit var preview: VideoView
    private lateinit var status: TextView
    private lateinit var exportButton: Button

    private val graph = TimelineGraph()
    private val track = MagneticTrack()
    private var pickedUri: Uri? = null
    private var chromaEnabled = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Preferir el modo de pantalla de mayor tasa (90Hz WUXGA+ en la Tab S10 Lite).
        val best = display?.supportedModes?.maxByOrNull { it.refreshRate }
        if (best != null) {
            window.attributes = window.attributes.apply {
                preferredDisplayModeId = best.modeId
            }
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContentView(buildLayout())
    }

    private fun buildLayout(): LinearLayout {
        val density = resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()

        preview = VideoView(this).apply {
            setOnPreparedListener { mp ->
                mp.isLooping = true
                mp.setVolume(0f, 0f) // preview silencioso
            }
            setOnErrorListener { _, what, extra ->
                setStatus("No se pudo previsualizar (error $what/$extra)")
                true
            }
        }

        val addButton = Button(this).apply {
            text = "+ Video"
            setOnClickListener { pickVideo() }
        }
        val chromaSwitch = Switch(this).apply {
            text = "Chroma key"
            setOnCheckedChangeListener { _, checked -> chromaEnabled = checked }
        }
        exportButton = Button(this).apply {
            text = "Exportar"
            setOnClickListener { startExport() }
        }

        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(6), dp(12), dp(6))
            addView(addButton, LinearLayout.LayoutParams(0, WRAP, 1f))
            addView(chromaSwitch, LinearLayout.LayoutParams(0, WRAP, 1f))
            addView(exportButton, LinearLayout.LayoutParams(0, WRAP, 1f))
        }

        status = TextView(this).apply {
            text = "Añade un video para empezar"
            setPadding(dp(16), dp(4), dp(16), dp(4))
        }

        timeline = TimelineView(this).apply { track = this@EditorActivity.track }

        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.BLACK)
            addView(preview, LinearLayout.LayoutParams(MATCH, 0, 1f))
            addView(controls, LinearLayout.LayoutParams(MATCH, WRAP))
            addView(status, LinearLayout.LayoutParams(MATCH, WRAP))
            addView(timeline, LinearLayout.LayoutParams(MATCH, dp(140)))
        }
    }

    private fun pickVideo() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            type = "video/*"
            addCategory(Intent.CATEGORY_OPENABLE)
            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            )
        }
        try {
            startActivityForResult(intent, REQUEST_PICK_VIDEO)
        } catch (t: Throwable) {
            setStatus("No hay selector de documentos disponible")
            Log.e(TAG, "ACTION_OPEN_DOCUMENT falló", t)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_PICK_VIDEO || resultCode != RESULT_OK) return
        val uri = data?.data ?: return

        try {
            // Persistir el permiso: el ExportWorker corre en otro momento/proceso.
            contentResolver.takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        } catch (t: Throwable) {
            Log.w(TAG, "Permiso persistente no concedido; la exportación inmediata funcionará igual", t)
        }

        val durationMs = readDurationMs(uri)
        if (durationMs <= 0) {
            setStatus("El archivo no parece un video válido")
            return
        }

        pickedUri = uri
        track.append(
            ClipNode(
                id = graph.nextId(),
                sourceUri = uri.toString(),
                sourceInMs = 0,
                durationMs = durationMs
            )
        )
        timeline.track = track // reasignar invalida y redibuja

        preview.setVideoURI(uri)
        preview.start()
        setStatus("Clip añadido (${durationMs / 1000}s). Total: ${track.totalDurationMs / 1000}s")
    }

    private fun readDurationMs(uri: Uri): Long {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(this, uri)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull() ?: 0L
        } catch (t: Throwable) {
            Log.e(TAG, "No se pudo leer metadata de $uri", t)
            0L
        } finally {
            try {
                retriever.release()
            } catch (_: Throwable) { }
        }
    }

    private fun startExport() {
        val uri = pickedUri
        if (uri == null) {
            setStatus("Añade un video primero")
            return
        }
        exportButton.isEnabled = false
        setStatus("Exportando… 0%")

        val workId = ExportManager.enqueue(this, uri.toString(), chromaEnabled)
        progressJob?.cancel()
        progressJob = scope.launch {
            ExportManager.progress(this@EditorActivity, workId).collect { p ->
                when (p) {
                    is ExportProgress.Running ->
                        setStatus("Exportando… ${(p.fraction * 100).toInt()}%")
                    is ExportProgress.Done -> {
                        setStatus("✔ Exportado a Galería → Movies/Vinki")
                        exportButton.isEnabled = true
                    }
                    is ExportProgress.Failed -> {
                        setStatus("✖ Exportación falló: ${p.reason}")
                        exportButton.isEnabled = true
                    }
                }
            }
        }
    }

    private fun setStatus(text: String) {
        status.text = text
    }

    override fun onDestroy() {
        progressJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "EditorActivity"
        private const val REQUEST_PICK_VIDEO = 0x1001
        private const val MATCH = LinearLayout.LayoutParams.MATCH_PARENT
        private const val WRAP = LinearLayout.LayoutParams.WRAP_CONTENT
    }
}
