#version 300 es
//
// DIRECTIONAL MOTION BLUR — difuminado vectorial para transiciones de barrido.
//
// uVelocity es el desplazamiento del contenido en coords UV **por frame de
// 90Hz**: la capa de UI (Choreographer a 90Hz en la Tab S10 Lite) evalúa la
// posición de la transición en cada vsync y entrega delta = pos(t) - pos(t-1).
// Así el largo de la estela es físicamente coherente con la velocidad real
// del barrido, a cualquier velocidad de gesto del S Pen.
//
// 16 taps con pesos gaussianos centrados: en la Mali-G68 los 16 fetches de un
// FBO RGBA8 1080p caben en ~0.9ms — presupuesto de sobra dentro de los 11.1ms.
//
precision highp float;

uniform sampler2D uScene;    // FBO de la pasada 1
uniform vec2 uVelocity;      // desplazamiento UV por frame @90Hz (0,0 = off)

in vec2 vTexCoord;
out vec4 outColor;

const int SAMPLES = 16;

void main() {
    // Salida temprana coherente (uniform branch: gratis en Mali).
    if (dot(uVelocity, uVelocity) < 1.0e-10) {
        outColor = texture(uScene, vTexCoord);
        return;
    }

    vec4 acc = vec4(0.0);
    float wsum = 0.0;

    // Muestras centradas en el píxel: t ∈ [-0.5, +0.5] a lo largo del vector.
    for (int i = 0; i < SAMPLES; i++) {
        float t = (float(i) + 0.5) / float(SAMPLES) - 0.5;
        // Peso gaussiano: estela con núcleo nítido y colas suaves (look cine,
        // no el "ghosting" plano de un box blur).
        float w = exp(-4.5 * t * t);
        vec2 uv = clamp(vTexCoord + uVelocity * t, vec2(0.001), vec2(0.999));
        acc += texture(uScene, uv) * w;
        wsum += w;
    }

    outColor = acc / wsum;
}
