package com.vinki.videoeditor.ai

import com.vinki.videoeditor.core.BurnSubtitle
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Serialización de subtítulos a JSON en disco: la Activity los escribe y el
 * ExportWorker los lee — sobrevive a la muerte del proceso entre encolar el
 * Work y su ejecución (WorkManager Data tiene límite de 10KB; un archivo no).
 */
object SubtitleJson {

    fun write(file: File, subtitles: List<EditableSubtitle>) {
        val arr = JSONArray()
        for (s in subtitles) {
            arr.put(
                JSONObject()
                    .put("s", s.startMs)
                    .put("e", s.endMs)
                    .put("t", s.displayText)
            )
        }
        file.writeText(arr.toString())
    }

    fun readAsBurnList(file: File): List<BurnSubtitle> {
        if (!file.exists()) return emptyList()
        return try {
            val arr = JSONArray(file.readText())
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                BurnSubtitle(
                    startMs = o.getLong("s"),
                    endMs = o.getLong("e"),
                    text = o.getString("t")
                )
            }
        } catch (_: Throwable) {
            emptyList()
        }
    }
}
