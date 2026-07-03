package com.vinki.videoeditor.ai

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.ByteBufferExtractor
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.imagesegmenter.ImageSegmenter
import java.io.Closeable
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Segmentación de pantalla verde / retrato con MediaPipe Tasks Vision.
 *
 * Arquitectura del modelo: Mobile-UNet (encoder MobileNetV3 + decoder U-Net),
 * empaquetado como .tflite en assets. Ejecución forzada en GPU Delegate:
 * en la Mali-G68 MP5 la inferencia 256x256 corre en ~6-8ms — dentro del
 * presupuesto de un frame a 90Hz y sin ocupar los Cortex (que whisper y el
 * decoder ya explotan). CPU y GPU trabajan en paralelo real.
 *
 * El post-procesado del borde (anti-aliasing orgánico) NO se hace aquí:
 * se hace en el shader (chroma_key.frag / mask_aa.frag) con fwidth, donde
 * cuesta nanosegundos por píxel. Esta clase solo produce la máscara R8.
 */
class GreenScreenSegmenter(
    context: Context,
    modelAssetPath: String = "models/selfie_segmenter.tflite"
) : Closeable {

    private val segmenter: ImageSegmenter

    @Volatile
    private var closed = false

    init {
        try {
            val baseOptions = BaseOptions.builder()
                .setModelAssetPath(modelAssetPath)
                .setDelegate(Delegate.GPU) // explícito: Mali-G68, no CPU ni NNAPI
                .build()

            val options = ImageSegmenter.ImageSegmenterOptions.builder()
                .setBaseOptions(baseOptions)
                // VIDEO: timestamps monótonos, el grafo reutiliza estado entre
                // frames (tracking temporal del borde) sin callbacks asíncronos.
                .setRunningMode(RunningMode.VIDEO)
                .setOutputConfidenceMasks(true)
                .setOutputCategoryMask(false)
                .build()

            segmenter = ImageSegmenter.createFromOptions(context, options)
        } catch (t: Throwable) {
            Log.e(TAG, "No se pudo crear ImageSegmenter (GPU delegate)", t)
            throw SegmenterException("Fallo inicializando MediaPipe ImageSegmenter", t)
        }
    }

    /**
     * Segmenta un frame. [timestampMs] DEBE ser monótonamente creciente
     * (contrato de RunningMode.VIDEO). Devuelve la máscara de confianza
     * cuantizada a R8, lista para glTexImage2D(GL_R8) →
     * FramePipelineRenderer.uploadAiMask().
     */
    fun segmentFrame(frame: Bitmap, timestampMs: Long): SegmentationMask {
        check(!closed) { "Segmenter ya cerrado" }
        val mpImage = BitmapImageBuilder(frame).build()
        try {
            val result = segmenter.segmentForVideo(mpImage, timestampMs)
            val masks = result.confidenceMasks()
            check(masks.isPresent && masks.get().isNotEmpty()) {
                "El modelo no devolvió máscaras de confianza"
            }

            // Canal 0 = primer plano (persona) en los modelos de selfie/retrato.
            val mask = masks.get()[0]
            val width = mask.width
            val height = mask.height

            val floatBuffer = ByteBufferExtractor.extract(mask)
                .order(ByteOrder.nativeOrder())
                .asFloatBuffer()

            // float32 [0,1] → R8: 4x menos ancho de banda de subida a GPU y
            // GL_R8 es filtrable-linear en Mali sin extensiones (GL_R32F no).
            val bytes = ByteBuffer.allocateDirect(width * height)
            for (i in 0 until width * height) {
                val v = floatBuffer.get(i)
                bytes.put(i, (v.coerceIn(0f, 1f) * 255f).toInt().toByte())
            }
            bytes.position(0)

            mask.close()
            return SegmentationMask(bytes, width, height, timestampMs)
        } finally {
            mpImage.close()
        }
    }

    override fun close() {
        if (closed) return
        closed = true
        try {
            segmenter.close()
        } catch (t: Throwable) {
            Log.w(TAG, "Error cerrando segmenter", t)
        }
    }

    companion object {
        private const val TAG = "GreenScreenSegmenter"
    }
}

/** Máscara R8 lista para subir a GPU. [buffer] es direct — cero copias JNI. */
class SegmentationMask(
    val buffer: ByteBuffer,
    val width: Int,
    val height: Int,
    val timestampMs: Long
)

class SegmenterException(message: String, cause: Throwable? = null) : Exception(message, cause)
