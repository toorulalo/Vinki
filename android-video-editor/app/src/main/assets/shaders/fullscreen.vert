#version 300 es
// Quad fullscreen. uTexMatrix es la matriz de SurfaceTexture.getTransformMatrix:
// aplica el crop + flip + ROTACIÓN DE HARDWARE que el productor (decoder)
// declaró en el BufferQueue. Multiplicarla aquí cuesta 0 en fragment.
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aTexCoord;

uniform mat4 uTexMatrix;

out vec2 vTexCoord;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vTexCoord = (uTexMatrix * vec4(aTexCoord, 0.0, 1.0)).xy;
}
