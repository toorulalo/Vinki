package com.vinki.videoeditor.ui

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import android.widget.VideoView
import com.vinki.videoeditor.ai.AudioPcmExtractor
import com.vinki.videoeditor.ai.EditableSubtitle
import com.vinki.videoeditor.ai.SubtitleEngine
import com.vinki.videoeditor.ai.SubtitleJson
import com.vinki.videoeditor.ai.WhisperBridge
import com.vinki.videoeditor.ai.WhisperModelInstaller
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
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Editor completo:
 *
 *   [ Previsualización (VideoView) ]
 *   [ + Video ] [ Subtítulos IA ] [ Exportar ]
 *   [ Chroma ⭘ ] [ Transiciones ⭘ ]  [ estado ]
 *   [ Timeline magnética 90Hz ]
 *
 * Exportar renderiza TODA la timeline (multi-clip, PTS continuos) con audio,
 * transiciones whip-pan opcionales y subtítulos quemados si se generaron.
 */
class EditorActivity : Activity() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var progressJob: Job? = null
    private var asrJob: Job? = null

    private lateinit var timeline: TimelineView
    private lateinit var preview: VideoView
    private lateinit var status: TextView
    private lateinit var exportButton: Button
    private lateinit var subsButton: Button

    private val graph = TimelineGraph()
    private val track = MagneticTrack()
    private var chromaEnabled = false
    private var whipPanEnabled = false
    private val subtitles = mutableListOf<EditableSubtitle>()
    private var burnSubtitles = false

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
        subsButton = Button(this).apply {
            text = "Subtítulos IA"
            setOnClickListener { generateSubtitles() }
        }
        exportButton = Button(this).apply {
            text = "Exportar"
            setOnClickListener { startExport() }
        }

        val buttonsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(4), dp(12), 0)
            addView(addButton, LinearLayout.LayoutParams(0, WRAP, 1f))
            addView(subsButton, LinearLayout.LayoutParams(0, WRAP, 1f))
            addView(exportButton, LinearLayout.LayoutParams(0, WRAP, 1f))
        }

        val chromaSwitch = Switch(this).apply {
            text = "Chroma key"
            setOnCheckedChangeListener { _, checked -> chromaEnabled = checked }
        }
        val whipSwitch = Switch(this).apply {
            text = "Transiciones"
            setOnCheckedChangeListener { _, checked -> whipPanEnabled = checked }
        }
        status = TextView(this).apply {
            text = "Añade un video para empezar"
            gravity = Gravity.CENTER_VERTICAL
        }
        val togglesRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), 0, dp(16), dp(4))
            addView(chromaSwitch, LinearLayout.LayoutParams(WRAP, WRAP))
            addView(whipSwitch, LinearLayout.LayoutParams(WRAP, WRAP).apply {
                marginStart = dp(16)
            })
            addView(status, LinearLayout.LayoutParams(0, WRAP, 1f).apply {
                marginStart = dp(16)
            })
        }

        timeline = TimelineView(this).apply { track = this@EditorActivity.track }

        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.BLACK)
            addView(preview, LinearLayout.LayoutParams(MATCH, 0, 1f))
            addView(buttonsRow, LinearLayout.LayoutParams(MATCH, WRAP))
            addView(togglesRow, LinearLayout.LayoutParams(MATCH, WRAP))
            addView(timeline, LinearLayout.LayoutParams(MATCH, dp(140)))
        }
    }

    // ------------------------------------------------------------------ clips

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
            Log.w(TAG, "Permiso persistente no concedido", t)
        }

        val durationMs = readDurationMs(uri)
        if (durationMs <= 0) {
            setStatus("El archivo no parece un video válido")
            return
        }

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
        setStatus(
            "${track.size} clip(s), total ${track.totalDurationMs / 1000}s"
        )
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

    // -------------------------------------------------------------- subtítulos

    private fun generateSubtitles() {
        val clips = track.placed()
        if (clips.isEmpty()) {
            setStatus("Añade un video primero")
            return
        }
        if (!WhisperBridge.isAvailable) {
            setStatus("Este APK se compiló sin el motor de subtítulos")
            return
        }
        if (subtitles.isNotEmpty()) {
            showSubtitleEditor()
            return
        }

        subsButton.isEnabled = false
        asrJob?.cancel()
        asrJob = scope.launch {
            try {
                setStatus("Preparando modelo de voz…")
                val modelPath = withContext(Dispatchers.IO) {
                    WhisperModelInstaller.installedModelOrNull(this@EditorActivity)
                }
                if (modelPath == null) {
                    setStatus("Modelo whisper no incluido en este APK")
                    return@launch
                }

                val collected = mutableListOf<EditableSubtitle>()
                // Transcribe cada clip; los timestamps se desplazan al inicio
                // del clip en la timeline para que el quemado coincida.
                withContext(Dispatchers.Default) {
                    SubtitleEngine(this@EditorActivity, modelPath).use { asr ->
                        for (placed in clips) {
                            withContext(Dispatchers.Main) {
                                setStatus("Extrayendo audio (${collected.size} subt.)…")
                            }
                            val pcm = try {
                                AudioPcmExtractor.extract(
                                    this@EditorActivity, Uri.parse(placed.clip.sourceUri)
                                )
                            } catch (t: Throwable) {
                                Log.w(TAG, "Clip sin audio transcribible", t)
                                continue
                            }
                            withContext(Dispatchers.Main) { setStatus("Transcribiendo…") }
                            asr.transcribe(pcm).collect { sub ->
                                collected += sub.copy(
                                    startMs = sub.startMs + placed.startMs,
                                    endMs = sub.endMs + placed.startMs
                                )
                                withContext(Dispatchers.Main) {
                                    setStatus("Transcribiendo… ${collected.size} subtítulos")
                                }
                            }
                        }
                    }
                }

                subtitles.clear()
                subtitles += collected.sortedBy { it.startMs }
                if (subtitles.isEmpty()) {
                    setStatus("No se detectó voz en el audio")
                } else {
                    burnSubtitles = true
                    setStatus("${subtitles.size} subtítulos listos (se quemarán al exportar)")
                    showSubtitleEditor()
                }
            } catch (t: Throwable) {
                Log.e(TAG, "ASR falló", t)
                setStatus("Subtítulos fallaron: ${t.message}")
            } finally {
                subsButton.isEnabled = true
            }
        }
    }

    /** Lista editable: tocar un subtítulo abre un cuadro para corregir el texto. */
    private fun showSubtitleEditor() {
        if (subtitles.isEmpty()) return
        val labels = subtitles.map {
            "[${it.startMs / 1000}s→${it.endMs / 1000}s]  ${it.displayText}"
        }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Subtítulos (${subtitles.size}) — toca para editar")
            .setItems(labels) { _, index -> editSubtitle(index) }
            .setPositiveButton(if (burnSubtitles) "Quemar al exportar ✔" else "Quemar al exportar") { _, _ ->
                burnSubtitles = true
                setStatus("${subtitles.size} subtítulos se quemarán al exportar")
            }
            .setNegativeButton("No quemar") { _, _ ->
                burnSubtitles = false
                setStatus("Subtítulos generados pero NO se quemarán")
            }
            .setNeutralButton("Descartar todos") { _, _ ->
                subtitles.clear()
                burnSubtitles = false
                setStatus("Subtítulos descartados")
            }
            .show()
    }

    private fun editSubtitle(index: Int) {
        val sub = subtitles[index]
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            setText(sub.displayText)
            setSelection(sub.displayText.length)
        }
        AlertDialog.Builder(this)
            .setTitle("Editar subtítulo [${sub.startMs / 1000}s]")
            .setView(input)
            .setPositiveButton("Guardar") { _, _ ->
                val newText = input.text?.toString()?.trim().orEmpty()
                subtitles[index] =
                    if (newText.isEmpty() || newText == sub.text) sub.copy(editedText = null)
                    else sub.copy(editedText = newText)
                showSubtitleEditor()
            }
            .setNegativeButton("Cancelar") { _, _ -> showSubtitleEditor() }
            .show()
    }

    // ------------------------------------------------------------- exportación

    private fun startExport() {
        val clips = track.placed()
        if (clips.isEmpty()) {
            setStatus("Añade un video primero")
            return
        }
        exportButton.isEnabled = false
        setStatus("Exportando… 0%")

        val subsPath: String? = if (burnSubtitles && subtitles.isNotEmpty()) {
            val f = File(cacheDir, "export_subs.json")
            try {
                SubtitleJson.write(f, subtitles)
                f.absolutePath
            } catch (t: Throwable) {
                Log.w(TAG, "No se pudieron serializar subtítulos", t)
                null
            }
        } else null

        val workId = ExportManager.enqueue(
            context = this,
            inputUris = clips.map { it.clip.sourceUri },
            durationsMs = clips.map { it.clip.durationMs },
            chromaKey = chromaEnabled,
            whipPan = whipPanEnabled && clips.size > 1,
            subtitlesJsonPath = subsPath
        )
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
        asrJob?.cancel()
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
