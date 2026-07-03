#version 300 es
// Quad de overlay posicionado en NDC vía uScale/uOffset (franja de subtítulos).
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aTexCoord;

uniform vec2 uScale;
uniform vec2 uOffset;

out vec2 vTexCoord;

void main() {
    gl_Position = vec4(aPosition * uScale + uOffset, 0.0, 1.0);
    // El Bitmap se sube con la fila 0 arriba; el quad tiene v=0 abajo: voltear.
    vTexCoord = vec2(aTexCoord.x, 1.0 - aTexCoord.y);
}
