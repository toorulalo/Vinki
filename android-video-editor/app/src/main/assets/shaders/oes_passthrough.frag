#version 300 es
#extension GL_OES_EGL_image_external_essl3 : require
// Copia directa OES → FBO cuando no hay chroma key activo.
precision mediump float;

uniform samplerExternalOES uTexture;

in vec2 vTexCoord;
out vec4 outColor;

void main() {
    outColor = texture(uTexture, vTexCoord);
}
