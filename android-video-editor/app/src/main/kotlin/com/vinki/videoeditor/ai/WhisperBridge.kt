package com.vinki.videoeditor.ai

/**
 * Puente JNI 1:1 con whisper_jni.cpp. No usar directamente: [SubtitleEngine]
 * es quien garantiza la serialización de llamadas y el troceado en lotes.
 */
internal object WhisperBridge {
    init {
        System.loadLibrary("vinki_whisper")
    }

    @JvmStatic
    external fun nativeInit(modelPath: String, nThreads: Int): Long

    @JvmStatic
    external fun nativeTranscribe(
        handle: Long,
        pcm: FloatArray,
        language: String
    ): Array<WhisperSegment>

    @JvmStatic
    external fun nativeRelease(handle: Long)
}

/**
 * Segmento crudo devuelto por JNI. Timestamps en ms RELATIVOS al lote.
 * El constructor (JJLjava/lang/String;)V se invoca por reflexión desde C++:
 * no cambiar la firma sin tocar whisper_jni.cpp.
 */
class WhisperSegment(
    @JvmField val startMs: Long,
    @JvmField val endMs: Long,
    @JvmField val text: String
)
