package com.vinki.videoeditor.export

import java.io.File

/**
 * Constructor del comando FFmpeg para el ensamblaje final (muxing headless).
 *
 * Punto crítico: -c:v h264_mediacodec / hevc_mediacodec fuerza que la
 * codificación ocurra FÍSICAMENTE en el MFC (Multi-Format Codec) del
 * Exynos 1380 vía NDK AMediaCodec — FFmpeg solo orquesta demux/filtros/mux;
 * ni un solo macrobloque se codifica en los Cortex. Requiere un build de
 * ffmpeg-kit con --enable-mediacodec --enable-jni (el AAR full-gpl lo trae).
 */
enum class HwCodec(val ffmpegName: String) {
    H264("h264_mediacodec"),
    HEVC("hevc_mediacodec")
}

data class ExportSpec(
    val inputPath: String,
    val outputPath: String,
    val codec: HwCodec = HwCodec.HEVC,
    val videoBitrate: Long = 20_000_000,
    val audioBitrate: Long = 256_000,
    val fps: Int = 60,
    val width: Int? = null,
    val height: Int? = null
) {
    init {
        require(inputPath.isNotBlank()) { "inputPath vacío" }
        require(outputPath.isNotBlank()) { "outputPath vacío" }
        require(videoBitrate in 1_000_000..80_000_000) { "bitrate fuera de rango sensato" }
        require(fps in 24..120) { "fps fuera de rango" }
    }
}

object FfmpegCommandBuilder {

    fun build(spec: ExportSpec): String {
        val input = File(spec.inputPath)
        require(input.exists()) { "El archivo de entrada no existe: ${spec.inputPath}" }

        val scale = if (spec.width != null && spec.height != null) {
            // Dimensiones pares: los codecs HW rechazan resoluciones impares.
            val w = spec.width and 1.inv()
            val h = spec.height and 1.inv()
            "-vf scale=$w:$h:flags=bicubic "
        } else ""

        return buildString {
            append("-y ")
            append("-i ${quote(spec.inputPath)} ")
            append(scale)
            // Encoder por hardware del Exynos 1380 — obligatorio.
            append("-c:v ${spec.codec.ffmpegName} ")
            // CBR también en la ruta FFmpeg: coherente con el motor interno.
            append("-bitrate_mode cbr ")
            append("-b:v ${spec.videoBitrate} ")
            // 60 FPS estables: CFR estricto, sin drops ni duplicados variables.
            append("-fps_mode cfr -r ${spec.fps} ")
            append("-g ${spec.fps} ")
            append("-c:a aac -b:a ${spec.audioBitrate} ")
            // moov al inicio: reproducible en streaming/compartido al instante.
            append("-movflags +faststart ")
            append(quote(spec.outputPath))
        }
    }

    /** Blindaje contra rutas con espacios/caracteres raros del SAF. */
    private fun quote(path: String): String = "\"${path.replace("\"", "\\\"")}\""
}
