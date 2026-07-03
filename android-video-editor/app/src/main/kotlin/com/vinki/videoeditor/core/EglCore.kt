package com.vinki.videoeditor.core

import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLExt
import android.opengl.EGLSurface
import android.util.Log
import android.view.Surface

/**
 * Contexto EGL 1.4 / GLES 3.0 encapsulado para el hilo de render (Hilo 2).
 *
 * EGL_RECORDABLE_ANDROID es obligatorio: le indica al driver Mali que el
 * EGLSurface de destino es el input-surface de un MediaCodec, habilitando la
 * ruta de composición directa decoder → GPU → encoder sin copias a RAM
 * (zero-copy real: los dmabuf del BufferQueue nunca tocan el heap de la app).
 */
class EglCore {

    private var display: EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var context: EGLContext = EGL14.EGL_NO_CONTEXT
    private var config: EGLConfig? = null

    init {
        display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        check(display != EGL14.EGL_NO_DISPLAY) { "eglGetDisplay falló" }

        val version = IntArray(2)
        check(EGL14.eglInitialize(display, version, 0, version, 1)) {
            "eglInitialize falló: 0x${Integer.toHexString(EGL14.eglGetError())}"
        }

        val attribs = intArrayOf(
            EGL14.EGL_RED_SIZE, 8,
            EGL14.EGL_GREEN_SIZE, 8,
            EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_ALPHA_SIZE, 8,
            EGL14.EGL_RENDERABLE_TYPE, EGLExt.EGL_OPENGL_ES3_BIT_KHR,
            EGL_RECORDABLE_ANDROID, 1,
            EGL14.EGL_NONE
        )
        val configs = arrayOfNulls<EGLConfig>(1)
        val num = IntArray(1)
        check(
            EGL14.eglChooseConfig(display, attribs, 0, configs, 0, 1, num, 0) && num[0] > 0
        ) { "Sin EGLConfig GLES3 grabable (EGL_RECORDABLE_ANDROID)" }
        config = configs[0]

        val ctxAttribs = intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 3, EGL14.EGL_NONE)
        context = EGL14.eglCreateContext(display, config, EGL14.EGL_NO_CONTEXT, ctxAttribs, 0)
        checkEglError("eglCreateContext")
        check(context != EGL14.EGL_NO_CONTEXT) { "eglCreateContext devolvió NO_CONTEXT" }
    }

    fun createWindowSurface(surface: Surface): EGLSurface {
        val attribs = intArrayOf(EGL14.EGL_NONE)
        val eglSurface = EGL14.eglCreateWindowSurface(display, config, surface, attribs, 0)
        checkEglError("eglCreateWindowSurface")
        check(eglSurface != null && eglSurface != EGL14.EGL_NO_SURFACE) {
            "eglCreateWindowSurface falló"
        }
        return eglSurface
    }

    fun makeCurrent(surface: EGLSurface) {
        check(EGL14.eglMakeCurrent(display, surface, surface, context)) {
            "eglMakeCurrent falló: 0x${Integer.toHexString(EGL14.eglGetError())}"
        }
    }

    /**
     * PTS del frame propagado al encoder. Sin esto MediaCodec inventa timestamps
     * y el muxer produce VFR corrupto.
     */
    fun setPresentationTime(surface: EGLSurface, nsecs: Long) {
        EGLExt.eglPresentationTimeANDROID(display, surface, nsecs)
        checkEglError("eglPresentationTimeANDROID")
    }

    fun swapBuffers(surface: EGLSurface): Boolean = EGL14.eglSwapBuffers(display, surface)

    fun releaseSurface(surface: EGLSurface) {
        if (surface != EGL14.EGL_NO_SURFACE) EGL14.eglDestroySurface(display, surface)
    }

    fun release() {
        if (display != EGL14.EGL_NO_DISPLAY) {
            EGL14.eglMakeCurrent(
                display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT
            )
            if (context != EGL14.EGL_NO_CONTEXT) EGL14.eglDestroyContext(display, context)
            EGL14.eglReleaseThread()
            EGL14.eglTerminate(display)
        }
        display = EGL14.EGL_NO_DISPLAY
        context = EGL14.EGL_NO_CONTEXT
        config = null
    }

    private fun checkEglError(op: String) {
        val err = EGL14.eglGetError()
        if (err != EGL14.EGL_SUCCESS) {
            Log.e(TAG, "$op: error EGL 0x${Integer.toHexString(err)}")
        }
    }

    companion object {
        private const val TAG = "EglCore"
        private const val EGL_RECORDABLE_ANDROID = 0x3142
    }
}
