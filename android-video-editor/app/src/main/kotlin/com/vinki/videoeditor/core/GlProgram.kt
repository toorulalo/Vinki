package com.vinki.videoeditor.core

import android.content.Context
import android.opengl.GLES30
import android.util.Log
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Compila/enlaza programas ESSL 3.00 con caché AOT de binarios de programa.
 *
 * En la Mali-G68 el compilador de shaders del driver corre en la CPU y puede
 * costar >30ms por programa: inaceptable a 90Hz. Estrategia en dos capas:
 *
 *  1. AOT offline (build): GLSL → SPIR-V (glslang) → spirv-opt → SPIRV-Cross
 *     → ESSL optimizado empaquetado en assets/shaders/compiled/. Ver
 *     cpp/shaders/CMakeLists.txt y README.
 *  2. AOT on-device (primer arranque): glGetProgramBinary persiste el binario
 *     nativo Mali en cacheDir; los arranques siguientes hacen glProgramBinary
 *     y saltan el compilador por completo.
 */
class GlProgram private constructor(val programId: Int) {

    private val uniformCache = HashMap<String, Int>()

    fun use() = GLES30.glUseProgram(programId)

    fun uniformLocation(name: String): Int =
        uniformCache.getOrPut(name) { GLES30.glGetUniformLocation(programId, name) }

    fun attribLocation(name: String): Int = GLES30.glGetAttribLocation(programId, name)

    fun release() {
        if (programId != 0) GLES30.glDeleteProgram(programId)
    }

    companion object {
        private const val TAG = "GlProgram"

        fun fromAssets(context: Context, vertexAsset: String, fragmentAsset: String): GlProgram {
            val cacheKey = "${vertexAsset}_${fragmentAsset}".replace('/', '_')
            loadFromBinaryCache(context, cacheKey)?.let { return GlProgram(it) }

            val vertexSrc = context.assets.open(vertexAsset).bufferedReader().use { it.readText() }
            val fragmentSrc = context.assets.open(fragmentAsset).bufferedReader().use { it.readText() }
            val program = linkFromSource(vertexSrc, fragmentSrc)
            saveToBinaryCache(context, cacheKey, program)
            return GlProgram(program)
        }

        private fun linkFromSource(vertexSrc: String, fragmentSrc: String): Int {
            val vs = compileShader(GLES30.GL_VERTEX_SHADER, vertexSrc)
            val fs = try {
                compileShader(GLES30.GL_FRAGMENT_SHADER, fragmentSrc)
            } catch (t: Throwable) {
                GLES30.glDeleteShader(vs)
                throw t
            }

            val program = GLES30.glCreateProgram()
            check(program != 0) { "glCreateProgram falló" }
            GLES30.glAttachShader(program, vs)
            GLES30.glAttachShader(program, fs)
            // Pedir formato binario recuperable ANTES del link.
            GLES30.glProgramParameteri(
                program, GLES30.GL_PROGRAM_BINARY_RETRIEVABLE_HINT, GLES30.GL_TRUE
            )
            GLES30.glLinkProgram(program)
            // Los shaders ya están enlazados en el programa: liberar los objetos sueltos.
            GLES30.glDeleteShader(vs)
            GLES30.glDeleteShader(fs)

            val status = IntArray(1)
            GLES30.glGetProgramiv(program, GLES30.GL_LINK_STATUS, status, 0)
            if (status[0] != GLES30.GL_TRUE) {
                val log = GLES30.glGetProgramInfoLog(program)
                GLES30.glDeleteProgram(program)
                error("Link de programa falló: $log")
            }
            return program
        }

        private fun compileShader(type: Int, source: String): Int {
            val shader = GLES30.glCreateShader(type)
            check(shader != 0) { "glCreateShader falló (type=$type)" }
            GLES30.glShaderSource(shader, source)
            GLES30.glCompileShader(shader)
            val status = IntArray(1)
            GLES30.glGetShaderiv(shader, GLES30.GL_COMPILE_STATUS, status, 0)
            if (status[0] != GLES30.GL_TRUE) {
                val log = GLES30.glGetShaderInfoLog(shader)
                GLES30.glDeleteShader(shader)
                error("Compilación de shader falló: $log\n--- fuente ---\n$source")
            }
            return shader
        }

        private fun cacheFile(context: Context, key: String) =
            File(context.cacheDir, "shader_bin_$key.mali")

        private fun loadFromBinaryCache(context: Context, key: String): Int? {
            val file = cacheFile(context, key)
            if (!file.exists() || file.length() < 8) return null
            return try {
                val bytes = file.readBytes()
                val buf = ByteBuffer.wrap(bytes).order(ByteOrder.nativeOrder())
                val format = buf.int
                val data = ByteBuffer.wrap(bytes, 4, bytes.size - 4)
                    .order(ByteOrder.nativeOrder()).slice()

                val program = GLES30.glCreateProgram()
                GLES30.glProgramBinary(program, format, data, data.remaining())
                val status = IntArray(1)
                GLES30.glGetProgramiv(program, GLES30.GL_LINK_STATUS, status, 0)
                if (status[0] == GLES30.GL_TRUE) {
                    program
                } else {
                    // Binario inválido (driver actualizado tras OTA): purgar y recompilar.
                    GLES30.glDeleteProgram(program)
                    file.delete()
                    null
                }
            } catch (t: Throwable) {
                Log.w(TAG, "Caché de binario corrupta ($key), recompilando", t)
                file.delete()
                null
            }
        }

        private fun saveToBinaryCache(context: Context, key: String, program: Int) {
            try {
                val lenOut = IntArray(1)
                GLES30.glGetProgramiv(program, GLES30.GL_PROGRAM_BINARY_LENGTH, lenOut, 0)
                val length = lenOut[0]
                if (length <= 0) return

                val binary = ByteBuffer.allocateDirect(length).order(ByteOrder.nativeOrder())
                val formatOut = IntArray(1)
                val written = IntArray(1)
                GLES30.glGetProgramBinary(program, length, written, 0, formatOut, 0, binary)
                if (written[0] <= 0) return

                val out = ByteArray(4 + written[0])
                ByteBuffer.wrap(out).order(ByteOrder.nativeOrder()).apply {
                    putInt(formatOut[0])
                    binary.limit(written[0])
                    put(binary)
                }
                cacheFile(context, key).writeBytes(out)
            } catch (t: Throwable) {
                // La caché es una optimización: nunca debe tumbar el pipeline.
                Log.w(TAG, "No se pudo persistir binario de programa ($key)", t)
            }
        }
    }
}
