package com.vinki.videoeditor.ai

/**
 * Puente JNI 1:1 con whisper_jni.cpp. No usar directamente: [SubtitleEngine]
 * es quien garantiza la serialización de llamadas y el troceado en lotes.
 */
internal object WhisperBridge {

    /**
     * true si libvinki_whisper.so viene en el APK (whisper.cpp presente en el
     * build). Si es false, el subtitulado ASR está deshabilitado — la app
     * funciona igual, sin crashear en el classload.
     */
    @JvmStatic
    val isAvailable: Boolean = try {
        System.loadLibrary("vinki_whisper")
        true
    } catch (_: UnsatisfiedLinkError) {
        false
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
