#version 300 es
//
// ANTI-ALIASING ORGÁNICO DE MÁSCARA IA (post-proceso independiente).
//
// La máscara de confianza de Mobile-UNet llega a resolución de inferencia
// (p.ej. 256×256) y bilinealmente escalada muestra "escaleras" en el borde.
// Dos técnicas combinadas:
//   1. Filtro tienda 4-tap rotado 45° → suaviza el aliasing de magnificación.
//   2. Umbral adaptativo con fwidth → el ancho del borde es constante EN
//      PANTALLA (~1.5px) independientemente del zoom o resolución de la máscara.
//
precision mediump float;

uniform sampler2D uMask;        // R8 confianza [0,1]
uniform vec2 uMaskTexelSize;    // 1.0 / resolución de la máscara

in vec2 vTexCoord;
out vec4 outColor;

void main() {
    vec2 o = uMaskTexelSize * 0.5;

    // Tienda 4-tap en diagonal: 4 fetches bilineales = ventana efectiva 3x3.
    float m = texture(uMask, vTexCoord + vec2( o.x,  o.y)).r
            + texture(uMask, vTexCoord + vec2(-o.x,  o.y)).r
            + texture(uMask, vTexCoord + vec2( o.x, -o.y)).r
            + texture(uMask, vTexCoord + vec2(-o.x, -o.y)).r;
    m *= 0.25;

    // Rampa adaptativa: fwidth mide cuánto cambia m entre píxeles vecinos de
    // PANTALLA; el smoothstep siempre abarca ~1.5px reales → borde orgánico.
    float w = fwidth(m) * 1.5 + 1.0e-4;
    float edge = smoothstep(0.5 - w, 0.5 + w, m);

    outColor = vec4(edge, edge, edge, edge);
}
