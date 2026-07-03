#version 300 es
// Composición del overlay (subtítulos rasterizados, alpha premultiplicado).
precision mediump float;

uniform sampler2D uTex;

in vec2 vTexCoord;
out vec4 outColor;

void main() {
    outColor = texture(uTex, vTexCoord);
}
