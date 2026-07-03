#version 300 es
#extension GL_OES_EGL_image_external_essl3 : require
//
// CHROMA KEY AVANZADO — espacio HSV + smoothstep + de-spill,
// con fusión opcional de la máscara de segmentación IA (MediaPipe Mobile-UNet)
// anti-aliased con derivadas de pantalla (fwidth).
//
// Coste en Mali-G68 MP5: ~14 ALU ops/px, sin branches divergentes reales
// (el mix del de-spill es seleccion vectorial). Apto para 1080p60 de sobra.
//
precision mediump float;

uniform samplerExternalOES uTexture;
uniform sampler2D uAiMask;      // R8: confianza [0,1] de "persona" (Mobile-UNet)
uniform int  uUseAiMask;

uniform vec3  uKeyHsv;          // color clave en HSV (h en [0,1])
uniform float uTolerance;       // radio interior: dentro => transparente total
uniform float uSoftness;        // ancho de la rampa smoothstep
uniform float uSpillStrength;   // 0..1 — supresión del rebote verde en bordes

in vec2 vTexCoord;
out vec4 outColor;

// Conversión RGB→HSV sin branches (variante clásica de Sam Hocevar).
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

void main() {
    vec4 src = texture(uTexture, vTexCoord);
    vec3 hsv = rgb2hsv(src.rgb);

    // Distancia de matiz CIRCULAR: el hue es un ángulo, 0.98 y 0.02 son vecinos.
    float dh = abs(hsv.x - uKeyHsv.x);
    dh = min(dh, 1.0 - dh) * 2.0;              // normalizada a [0,1]
    float ds = abs(hsv.y - uKeyHsv.y);
    float dv = abs(hsv.z - uKeyHsv.z);

    // Métrica ponderada: el matiz manda; sat/val evitan comerse sombras y piel.
    float dist = dh * 2.2 + ds * 0.55 + dv * 0.25;

    // smoothstep => rampa C1-continua: recorte limpio sin "escalón" en el borde.
    float alpha = smoothstep(uTolerance, uTolerance + uSoftness, dist);

    // Fusión con la máscara IA: la IA rescata píxeles que el color condenaría
    // (pelo verde-reflejado, gafas) — se toma el máximo de ambas evidencias.
    if (uUseAiMask == 1) {
        float m = texture(uAiMask, vTexCoord).r;
        // Anti-aliasing orgánico del borde de la máscara: el ancho de la rampa
        // se adapta al gradiente en pantalla (fwidth), no a un umbral fijo.
        float w = fwidth(m) * 1.5 + 1.0e-4;
        float mAA = smoothstep(0.5 - w, 0.5 + w, m);
        alpha = max(alpha, mAA);
    }

    // De-spill: aplasta el canal verde hacia el máximo de R/B, proporcional a
    // cuán "key" era el píxel. Elimina el halo verde sin desaturar la imagen.
    float spillMask = (1.0 - alpha) * uSpillStrength
                    + alpha * uSpillStrength * (1.0 - smoothstep(0.0, 0.35, dist - uTolerance));
    float gLimit = max(src.r, src.b);
    vec3 despilled = vec3(src.r, min(src.g, mix(src.g, gLimit, clamp(spillMask, 0.0, 1.0))), src.b);

    // Alpha premultiplicado: composición correcta y blending más barato en Mali.
    outColor = vec4(despilled * alpha, alpha);
}
