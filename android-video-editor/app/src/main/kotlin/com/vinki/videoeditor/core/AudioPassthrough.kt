package com.vinki.videoeditor.core

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import java.nio.ByteBuffer

/**
 * Copia la pista de audio al MP4 final SIN re-codificar (passthrough de
 * samples AAC comprimidos): cero CPU, cero pérdida de calidad.
 *
 * Multi-clip: los PTS de cada clip se desplazan por la duración acumulada.
 * Requiere que todos los clips compartan mime/sampleRate/channels — si no,
 * [createOrNull] devuelve null y la exportación sale sin audio (documentado
 * al usuario) en lugar de producir un MP4 corrupto.
 */
class AudioPassthrough private constructor(
    private val context: Context,
    private val sources: List<VideoSource>,
    val outputFormat: MediaFormat
) {

    /**
     * Vuelca TODAS las muestras de audio al muxer (ya arrancado). Se invoca
     * desde el Hilo 3 tras el EOS de video: MediaMuxer interlava por PTS al
     * escribir el moov, así que el orden por-pista basta.
     */
    fun writeAllSamples(muxer: MediaMuxer, trackIndex: Int) {
        val buffer = ByteBuffer.allocateDirect(MAX_SAMPLE_BYTES)
        val info = MediaCodec.BufferInfo()
        var offsetUs = 0L

        for (source in sources) {
            val extractor = source.openExtractor(context)
            try {
                val track = findAudioTrack(extractor) ?: continue
                extractor.selectTrack(track)
                while (true) {
                    val size = extractor.readSampleData(buffer, 0)
                    if (size < 0) break
                    val flags =
                        if (extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) {
                            MediaCodec.BUFFER_FLAG_KEY_FRAME
                        } else 0
                    info.set(0, size, extractor.sampleTime + offsetUs, flags)
                    muxer.writeSampleData(trackIndex, buffer, info)
                    extractor.advance()
                }
            } finally {
                try {
                    extractor.release()
                } catch (_: Throwable) { }
            }
            offsetUs += source.durationUs
        }
    }

    companion object {
        private const val TAG = "AudioPassthrough"
        private const val MAX_SAMPLE_BYTES = 512 * 1024

        fun createOrNull(context: Context, sources: List<VideoSource>): AudioPassthrough? {
            var reference: MediaFormat? = null
            for (source in sources) {
                val extractor = try {
                    source.openExtractor(context)
                } catch (t: Throwable) {
                    Log.w(TAG, "No se pudo abrir fuente para audio", t)
                    return null
                }
                try {
                    val track = findAudioTrack(extractor)
                    if (track == null) {
                        Log.w(TAG, "Clip sin pista de audio: exportando sin audio")
                        return null
                    }
                    val format = extractor.getTrackFormat(track)
                    val ref = reference
                    if (ref == null) {
                        reference = format
                    } else if (!compatible(ref, format)) {
                        Log.w(TAG, "Formatos de audio incompatibles entre clips: sin audio")
                        return null
                    }
                } finally {
                    try {
                        extractor.release()
                    } catch (_: Throwable) { }
                }
            }
            val format = reference ?: return null
            return AudioPassthrough(context.applicationContext, sources, format)
        }

        private fun findAudioTrack(extractor: MediaExtractor): Int? {
            for (i in 0 until extractor.trackCount) {
                val mime = extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: continue
                if (mime.startsWith("audio/")) return i
            }
            return null
        }

        private fun compatible(a: MediaFormat, b: MediaFormat): Boolean =
            a.getString(MediaFormat.KEY_MIME) == b.getString(MediaFormat.KEY_MIME) &&
                a.getInteger(MediaFormat.KEY_SAMPLE_RATE) == b.getInteger(MediaFormat.KEY_SAMPLE_RATE) &&
                a.getInteger(MediaFormat.KEY_CHANNEL_COUNT) == b.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
    }
}
