// ============================================================================
// whisper_jni.cpp — puente JNI para whisper.cpp en el Exynos 1380.
//
// Contrato de threading: whisper_context NO es reentrante. Este wrapper lo
// protege con un mutex, y además la capa Kotlin (SubtitleEngine) serializa
// los lotes en un dispatcher de un solo hilo — el mutex es el cinturón, el
// dispatcher son los tirantes.
//
// Modo BATCH estricto: cada llamada procesa un búfer independiente de ~10s.
// PROHIBIDO alimentar ventanas deslizantes solapadas: whisper es un
// encoder-decoder NO-CAUSAL — cada inferencia atiende sobre TODO el mel del
// lote. Solapar ventanas re-procesa audio ya transcrito (tokens duplicados)
// y multiplica el trabajo en los Cortex-A78, disparando el throttling térmico.
// ============================================================================

#include <jni.h>
#include <android/log.h>

#include <mutex>
#include <string>
#include <vector>

#include "whisper.h"

#define LOG_TAG "WhisperJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

struct WhisperHandle {
    whisper_context* ctx = nullptr;
    std::mutex mutex;
    int n_threads = 4;
};

void throw_java(JNIEnv* env, const char* msg) {
    jclass cls = env->FindClass("java/lang/IllegalStateException");
    if (cls != nullptr) {
        env->ThrowNew(cls, msg);
        env->DeleteLocalRef(cls);
    }
}

}  // namespace

extern "C" {

// ---------------------------------------------------------------------------
// nativeInit(modelPath: String, nThreads: Int): Long
//
// Modelo recomendado: ggml-base-q8_0.bin (~82MB). q8_0 mantiene >99% de la
// precisión FP16 y su GEMM entero cae en la ruta sdot/udot (dotprod) de los
// A78 — mejor perf/vatio que q5 (des-cuantización más cara) y que f16
// (el doble de ancho de banda de memoria, el cuello real en este SoC).
// ---------------------------------------------------------------------------
JNIEXPORT jlong JNICALL
Java_com_vinki_videoeditor_ai_WhisperBridge_nativeInit(
    JNIEnv* env, jclass /*clazz*/, jstring model_path, jint n_threads) {

    const char* path_chars = env->GetStringUTFChars(model_path, nullptr);
    if (path_chars == nullptr) {
        throw_java(env, "GetStringUTFChars devolvió null (OOM)");
        return 0;
    }
    std::string path(path_chars);
    env->ReleaseStringUTFChars(model_path, path_chars);

    whisper_context_params cparams = whisper_context_default_params();
    cparams.use_gpu = false;  // sin backend GPU útil para ggml en Mali; CPU dotprod es la ruta.

    whisper_context* ctx = whisper_init_from_file_with_params(path.c_str(), cparams);
    if (ctx == nullptr) {
        LOGE("No se pudo cargar el modelo: %s", path.c_str());
        throw_java(env, "whisper_init_from_file_with_params falló — ¿ruta/modelo corrupto?");
        return 0;
    }

    auto* handle = new WhisperHandle();
    handle->ctx = ctx;
    // Techo de 4 hilos: los 4 Cortex-A78. Usar los 8 cores arrastra a los A55
    // (que solo estorban en GEMM) y duplica el calor por <10% de mejora.
    handle->n_threads = n_threads > 0 && n_threads <= 4 ? n_threads : 4;

    LOGI("Modelo cargado (%s), n_threads=%d", path.c_str(), handle->n_threads);
    return reinterpret_cast<jlong>(handle);
}

// ---------------------------------------------------------------------------
// nativeTranscribe(handle, pcm: FloatArray, language: String): Array<WhisperSegment>
//
// pcm: mono float32 @16kHz, UN lote independiente (≈10s = 160.000 muestras).
// Devuelve segmentos con timestamps RELATIVOS AL LOTE (ms); la capa Kotlin
// suma el offset del lote.
// ---------------------------------------------------------------------------
JNIEXPORT jobjectArray JNICALL
Java_com_vinki_videoeditor_ai_WhisperBridge_nativeTranscribe(
    JNIEnv* env, jclass /*clazz*/, jlong handle_ptr, jfloatArray pcm, jstring language) {

    auto* handle = reinterpret_cast<WhisperHandle*>(handle_ptr);
    if (handle == nullptr || handle->ctx == nullptr) {
        throw_java(env, "Handle de whisper nulo o ya liberado");
        return nullptr;
    }

    const jsize n_samples = env->GetArrayLength(pcm);
    if (n_samples < WHISPER_SAMPLE_RATE / 2) {  // <0.5s: sin contenido útil
        jclass seg_cls = env->FindClass("com/vinki/videoeditor/ai/WhisperSegment");
        return seg_cls ? env->NewObjectArray(0, seg_cls, nullptr) : nullptr;
    }

    jfloat* samples = env->GetFloatArrayElements(pcm, nullptr);
    if (samples == nullptr) {
        throw_java(env, "GetFloatArrayElements devolvió null (OOM)");
        return nullptr;
    }

    const char* lang_chars = env->GetStringUTFChars(language, nullptr);
    std::string lang = lang_chars ? lang_chars : "auto";
    if (lang_chars) env->ReleaseStringUTFChars(language, lang_chars);

    int result;
    int n_segments = 0;
    std::vector<std::tuple<int64_t, int64_t, std::string>> segments;
    {
        std::lock_guard<std::mutex> lock(handle->mutex);

        whisper_full_params params =
            whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
        params.n_threads        = handle->n_threads;
        params.language         = lang == "auto" ? nullptr : lang.c_str();
        params.translate        = false;
        params.no_context       = true;   // cada lote es independiente (modo batch)
        params.single_segment   = false;
        params.suppress_blank   = true;
        params.print_progress   = false;
        params.print_realtime   = false;
        params.print_special    = false;
        params.print_timestamps = false;
        params.temperature      = 0.0f;
        params.max_len          = 0;

        result = whisper_full(handle->ctx, params, samples, n_samples);

        if (result == 0) {
            n_segments = whisper_full_n_segments(handle->ctx);
            segments.reserve(static_cast<size_t>(n_segments));
            for (int i = 0; i < n_segments; ++i) {
                // t0/t1 en centisegundos → ms.
                const int64_t t0 = whisper_full_get_segment_t0(handle->ctx, i) * 10;
                const int64_t t1 = whisper_full_get_segment_t1(handle->ctx, i) * 10;
                const char* text = whisper_full_get_segment_text(handle->ctx, i);
                segments.emplace_back(t0, t1, text ? text : "");
            }
        }
    }

    // JNI_ABORT: el búfer era de solo lectura; no copiar de vuelta al heap Java.
    env->ReleaseFloatArrayElements(pcm, samples, JNI_ABORT);

    if (result != 0) {
        LOGE("whisper_full falló con código %d", result);
        throw_java(env, "whisper_full falló");
        return nullptr;
    }

    jclass seg_cls = env->FindClass("com/vinki/videoeditor/ai/WhisperSegment");
    if (seg_cls == nullptr) return nullptr;  // excepción ya pendiente
    jmethodID ctor = env->GetMethodID(seg_cls, "<init>", "(JJLjava/lang/String;)V");
    if (ctor == nullptr) return nullptr;

    jobjectArray out = env->NewObjectArray(
        static_cast<jsize>(segments.size()), seg_cls, nullptr);
    if (out == nullptr) return nullptr;

    for (jsize i = 0; i < static_cast<jsize>(segments.size()); ++i) {
        const auto& [t0, t1, text] = segments[static_cast<size_t>(i)];
        jstring jtext = env->NewStringUTF(text.c_str());
        if (jtext == nullptr) return nullptr;
        jobject seg = env->NewObject(seg_cls, ctor,
                                     static_cast<jlong>(t0),
                                     static_cast<jlong>(t1),
                                     jtext);
        if (seg == nullptr) return nullptr;
        env->SetObjectArrayElement(out, i, seg);
        // Refs locales liberadas por iteración: el bucle no agota la tabla JNI.
        env->DeleteLocalRef(seg);
        env->DeleteLocalRef(jtext);
    }

    return out;
}

JNIEXPORT void JNICALL
Java_com_vinki_videoeditor_ai_WhisperBridge_nativeRelease(
    JNIEnv* /*env*/, jclass /*clazz*/, jlong handle_ptr) {

    auto* handle = reinterpret_cast<WhisperHandle*>(handle_ptr);
    if (handle == nullptr) return;
    {
        // Esperar cualquier transcripción en vuelo antes de destruir el contexto.
        std::lock_guard<std::mutex> lock(handle->mutex);
        if (handle->ctx != nullptr) {
            whisper_free(handle->ctx);
            handle->ctx = nullptr;
        }
    }
    delete handle;
    LOGI("Contexto whisper liberado");
}

}  // extern "C"
