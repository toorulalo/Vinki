package com.vinki.videoeditor.core

import android.content.Context
import android.opengl.GLES11Ext
import android.opengl.GLES30
import android.opengl.Matrix
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * Pipeline de render de 2 pasadas ejecutado íntegramente en el Hilo 2 (GL):
 *
 *   Pasada 1: GL_TEXTURE_EXTERNAL_OES (frame del decoder, vía SurfaceTexture)
 *             → FBO RGBA8. Aplica la matriz de transformación de hardware
 *             (getTransformMatrix: crop + flip + rotación del BufferQueue) y,
 *             opcionalmente, Chroma Key HSV + anti-aliasing de máscara IA.
 *   Pasada 2: FBO → EGLSurface del encoder. Aplica Directional Motion Blur
 *             (o passthrough si la velocidad es cero).
 *
 * Todo el estado GL vive y muere en el hilo GL; esta clase no es thread-safe
 * por diseño y lo verifica en runtime.
 */
class FramePipelineRenderer(
    context: Context,
    private val width: Int,
    private val height: Int
) {
    private val ownerThread = Thread.currentThread()

    // --- Programas ---------------------------------------------------------
    private val oesPassthrough = GlProgram.fromAssets(
        context, "shaders/fullscreen.vert", "shaders/oes_passthrough.frag"
    )
    private val oesChromaKey = GlProgram.fromAssets(
        context, "shaders/fullscreen.vert", "shaders/chroma_key.frag"
    )
    private val motionBlur = GlProgram.fromAssets(
        context, "shaders/fullscreen.vert", "shaders/motion_blur.frag"
    )

    // --- Geometría: quad fullscreen (triangle strip) ------------------------
    private val vertexBuffer: FloatBuffer = ByteBuffer
        .allocateDirect(QUAD.size * 4)
        .order(ByteOrder.nativeOrder())
        .asFloatBuffer()
        .apply { put(QUAD); position(0) }

    private val vao = IntArray(1)
    private val vbo = IntArray(1)

    // --- Texturas / FBO -----------------------------------------------------
    val oesTextureId: Int
    private val fboId: Int
    private val fboTextureId: Int
    private val maskTextureId: Int

    private val identityMatrix = FloatArray(16).also { Matrix.setIdentityM(it, 0) }

    // --- Estado de efectos (mutado solo desde el hilo GL) --------------------
    var chromaKeyConfig: ChromaKeyConfig? = null
    var aiMaskEnabled: Boolean = false
    var velocityNdc: FloatArray = floatArrayOf(0f, 0f)

    init {
        oesTextureId = createTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES)
        maskTextureId = createTexture(GLES30.GL_TEXTURE_2D)

        // FBO intermedio a resolución de salida.
        fboTextureId = createTexture(GLES30.GL_TEXTURE_2D)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, fboTextureId)
        GLES30.glTexImage2D(
            GLES30.GL_TEXTURE_2D, 0, GLES30.GL_RGBA8, width, height, 0,
            GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, null
        )
        val fbos = IntArray(1)
        GLES30.glGenFramebuffers(1, fbos, 0)
        fboId = fbos[0]
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, fboId)
        GLES30.glFramebufferTexture2D(
            GLES30.GL_FRAMEBUFFER, GLES30.GL_COLOR_ATTACHMENT0,
            GLES30.GL_TEXTURE_2D, fboTextureId, 0
        )
        val status = GLES30.glCheckFramebufferStatus(GLES30.GL_FRAMEBUFFER)
        check(status == GLES30.GL_FRAMEBUFFER_COMPLETE) {
            "FBO incompleto: 0x${Integer.toHexString(status)}"
        }
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)

        GLES30.glGenVertexArrays(1, vao, 0)
        GLES30.glGenBuffers(1, vbo, 0)
        GLES30.glBindVertexArray(vao[0])
        GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, vbo[0])
        GLES30.glBufferData(
            GLES30.GL_ARRAY_BUFFER, QUAD.size * 4, vertexBuffer, GLES30.GL_STATIC_DRAW
        )
        // layout: vec2 aPosition, vec2 aTexCoord — stride 16 bytes.
        GLES30.glEnableVertexAttribArray(0)
        GLES30.glVertexAttribPointer(0, 2, GLES30.GL_FLOAT, false, 16, 0)
        GLES30.glEnableVertexAttribArray(1)
        GLES30.glVertexAttribPointer(1, 2, GLES30.GL_FLOAT, false, 16, 8)
        GLES30.glBindVertexArray(0)
        checkGlError("init")
    }

    /**
     * Renderiza un frame completo. [texMatrix] es la matriz 4x4 devuelta por
     * SurfaceTexture.getTransformMatrix — aplica la rotación/crop de hardware
     * del productor (decoder) y es OBLIGATORIA para no ver el frame volteado.
     */
    fun drawFrame(texMatrix: FloatArray) {
        assertGlThread()

        // ---------- Pasada 1: OES → FBO ----------
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, fboId)
        GLES30.glViewport(0, 0, width, height)
        GLES30.glClearColor(0f, 0f, 0f, 1f)
        GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)

        val chroma = chromaKeyConfig
        val program = if (chroma != null) oesChromaKey else oesPassthrough
        program.use()
        GLES30.glUniformMatrix4fv(program.uniformLocation("uTexMatrix"), 1, false, texMatrix, 0)

        GLES30.glActiveTexture(GLES30.GL_TEXTURE0)
        GLES30.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, oesTextureId)
        GLES30.glUniform1i(program.uniformLocation("uTexture"), 0)

        if (chroma != null) {
            GLES30.glUniform3f(
                program.uniformLocation("uKeyHsv"), chroma.keyHue, chroma.keySat, chroma.keyVal
            )
            GLES30.glUniform1f(program.uniformLocation("uTolerance"), chroma.tolerance)
            GLES30.glUniform1f(program.uniformLocation("uSoftness"), chroma.softness)
            GLES30.glUniform1f(program.uniformLocation("uSpillStrength"), chroma.spillSuppression)
            GLES30.glUniform1i(program.uniformLocation("uUseAiMask"), if (aiMaskEnabled) 1 else 0)
            GLES30.glActiveTexture(GLES30.GL_TEXTURE1)
            GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, maskTextureId)
            GLES30.glUniform1i(program.uniformLocation("uAiMask"), 1)
        }

        GLES30.glBindVertexArray(vao[0])
        GLES30.glDrawArrays(GLES30.GL_TRIANGLE_STRIP, 0, 4)

        // ---------- Pasada 2: FBO → surface del encoder ----------
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
        GLES30.glViewport(0, 0, width, height)

        motionBlur.use()
        GLES30.glUniformMatrix4fv(
            motionBlur.uniformLocation("uTexMatrix"), 1, false, identityMatrix, 0
        )
        GLES30.glActiveTexture(GLES30.GL_TEXTURE0)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, fboTextureId)
        GLES30.glUniform1i(motionBlur.uniformLocation("uScene"), 0)
        GLES30.glUniform2f(
            motionBlur.uniformLocation("uVelocity"), velocityNdc[0], velocityNdc[1]
        )

        GLES30.glDrawArrays(GLES30.GL_TRIANGLE_STRIP, 0, 4)
        GLES30.glBindVertexArray(0)
        checkGlError("drawFrame")
    }

    /**
     * Sube la máscara de confianza de MediaPipe (R8, 1 byte/px) a la unidad de
     * textura de máscara. Llamar SOLO desde el hilo GL.
     */
    fun uploadAiMask(mask: ByteBuffer, maskWidth: Int, maskHeight: Int) {
        assertGlThread()
        mask.position(0)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, maskTextureId)
        GLES30.glPixelStorei(GLES30.GL_UNPACK_ALIGNMENT, 1)
        GLES30.glTexImage2D(
            GLES30.GL_TEXTURE_2D, 0, GLES30.GL_R8, maskWidth, maskHeight, 0,
            GLES30.GL_RED, GLES30.GL_UNSIGNED_BYTE, mask
        )
        checkGlError("uploadAiMask")
    }

    fun release() {
        assertGlThread()
        oesPassthrough.release()
        oesChromaKey.release()
        motionBlur.release()
        GLES30.glDeleteFramebuffers(1, intArrayOf(fboId), 0)
        GLES30.glDeleteTextures(3, intArrayOf(oesTextureId, fboTextureId, maskTextureId), 0)
        GLES30.glDeleteBuffers(1, vbo, 0)
        GLES30.glDeleteVertexArrays(1, vao, 0)
    }

    private fun assertGlThread() {
        check(Thread.currentThread() === ownerThread) {
            "FramePipelineRenderer usado fuera del hilo GL propietario"
        }
    }

    private fun createTexture(target: Int): Int {
        val ids = IntArray(1)
        GLES30.glGenTextures(1, ids, 0)
        GLES30.glBindTexture(target, ids[0])
        GLES30.glTexParameteri(target, GLES30.GL_TEXTURE_MIN_FILTER, GLES30.GL_LINEAR)
        GLES30.glTexParameteri(target, GLES30.GL_TEXTURE_MAG_FILTER, GLES30.GL_LINEAR)
        GLES30.glTexParameteri(target, GLES30.GL_TEXTURE_WRAP_S, GLES30.GL_CLAMP_TO_EDGE)
        GLES30.glTexParameteri(target, GLES30.GL_TEXTURE_WRAP_T, GLES30.GL_CLAMP_TO_EDGE)
        return ids[0]
    }

    private fun checkGlError(op: String) {
        val err = GLES30.glGetError()
        check(err == GLES30.GL_NO_ERROR) { "$op: glError 0x${Integer.toHexString(err)}" }
    }

    companion object {
        // x, y, u, v — triangle strip.
        private val QUAD = floatArrayOf(
            -1f, -1f, 0f, 0f,
            1f, -1f, 1f, 0f,
            -1f, 1f, 0f, 1f,
            1f, 1f, 1f, 1f
        )
    }
}

/** Parámetros del Chroma Key en espacio HSV (hue en [0,1], no en grados). */
data class ChromaKeyConfig(
    val keyHue: Float = 0.333f,        // verde puro
    val keySat: Float = 0.85f,
    val keyVal: Float = 0.75f,
    val tolerance: Float = 0.12f,      // radio interior (recorte duro)
    val softness: Float = 0.08f,       // ancho del smoothstep (borde suave)
    val spillSuppression: Float = 0.7f // 0..1, de-spill del rebote verde
)
