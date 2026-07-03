# Vinki Video — núcleo de editor de video on-device (Galaxy Tab S10 Lite)

Editor de video premium, 100% local, diseñado para UNA sola pieza de hardware:
**Samsung Galaxy Tab S10 Lite** — Exynos 1380 (4× Cortex-A78 + 4× Cortex-A55),
GPU Mali-G68 MP5, 8 GB RAM, panel 90 Hz WUXGA+, S Pen. Sin iOS, sin servidores.

```
android-video-editor/
├── app/src/main/kotlin/com/vinki/videoeditor/
│   ├── core/       Motor zero-copy de 3 hilos (MediaCodec + EGL/GLES3)
│   ├── ai/         whisper.cpp (JNI) + MediaPipe ImageSegmenter (GPU)
│   ├── timeline/   DAG de composición + pista magnética + keyframes Bézier
│   ├── input/      S Pen (presión/tilt) → tangentes Bézier
│   ├── export/     WorkManager FGS mediaProcessing + FFmpeg h264/hevc_mediacodec
│   └── ui/         TimelineView 90Hz (Choreographer + requestedFrameRate)
├── app/src/main/assets/shaders/   GLSL ESSL 3.00 (chroma key HSV, motion blur, AA)
└── app/src/main/cpp/              whisper_jni.cpp + CMake (incluye AOT SPIR-V)
```

## 1. Núcleo de renderizado zero-copy

Topología estricta de 3 hilos (ver `core/TranscodeEngine.kt`):

```
HILO 1 (Vinki-Decoder)          HILO 2 (Vinki-GlRender)         HILO 3 (Vinki-EncoderDrain)
MediaExtractor → MediaCodec ──▶ SurfaceTexture (OES) ─────────▶ MediaCodec encoder → MediaMuxer
decoder (c2.exynos)   Surface   updateTexImage()                CBR explícito
                                getTransformMatrix()  ← rotación HW obligatoria
                                shaders → EGLSurface del encoder
        ◀──────────── Semaphore(2): contrapresión ────────────
```

- **Zero-copy real**: los frames viajan como dmabuf por BufferQueues; ningún
  píxel toca el heap Java. Ocupación acotada: 2 frames NV12 en vuelo + 1 FBO.
- **Contrapresión**: `Semaphore(2)` impide que el decoder (que en el Exynos
  decodifica 1080p a >300 fps) inunde la memoria — crítico con 8 GB compartidos.
- **CBR explícito** (`KEY_BITRATE_MODE = BITRATE_MODE_CBR`): elude la
  heurística de calidad variable ("VMAF quality floor") del encoder, que en
  VBR hunde el bitrate en escenas estáticas y produce *pumping* de calidad.
- **PTS de extremo a extremo**: `releaseOutputBuffer(idx, ptsNs)` →
  `surfaceTexture.timestamp` → `eglPresentationTimeANDROID` → muxer. CFR limpio.
- EOS sin race: el decoder cuenta frames volcados, el hilo GL cuenta
  consumidos; `signalEndOfInputStream()` solo cuando coinciden.

## 2. Shaders y pipeline AOT SPIR-V

Shaders en `assets/shaders/` (ESSL 3.00):

- `chroma_key.frag` — RGB→HSV sin branches, distancia de matiz **circular**,
  recorte con `smoothstep` (rampa C¹), de-spill del rebote verde y fusión con
  la máscara IA anti-aliased con `fwidth`.
- `motion_blur.frag` — blur direccional de 16 muestras con pesos gaussianos.
  `uVelocity` = desplazamiento UV **por frame de 90 Hz** (la UI lo evalúa en
  cada vsync del Choreographer): la estela es físicamente coherente con la
  velocidad real del barrido.
- `mask_aa.frag` — anti-aliasing orgánico de máscara: filtro tienda 4-tap
  diagonal + umbral adaptativo `fwidth` (borde de ~1.5 px EN PANTALLA a
  cualquier zoom).

### ¿Por qué SPIR-V si GLES 3.0 no lo ingiere?

El pipeline AOT (`cpp/CMakeLists.txt`, target `shaders_aot`) es:

```
GLSL ──glslangValidator -G──▶ SPIR-V ──spirv-opt -O──▶ SPIR-V opt ──spirv-cross --es──▶ ESSL 300 final
```

1. **Validación en build**: un shader roto rompe la compilación, no el device.
2. **Optimización offline**: inlining/DCE/folding que el compilador *online*
   del driver Mali (que corre en CPU, compitiendo con la UI) ya no hace.
3. **Vulkan-ready**: el `.spv` se carga tal cual cuando el backend migre a
   Vulkan 1.3 (soportado por la Mali-G68). Coste de esa puerta hoy: cero.

En runtime, `GlProgram.kt` añade la segunda capa AOT: el primer arranque
persiste el **binario nativo Mali** (`glGetProgramBinary`) en `cacheDir`; los
siguientes arranques hacen `glProgramBinary` y no compilan absolutamente nada.

## 3. IA local vía JNI

### ASR editable — whisper.cpp (`ai/SubtitleEngine.kt`, `cpp/whisper_jni.cpp`)

- Modelo recomendado: **`ggml-base-q8_0.bin`** — el GEMM entero de q8_0 cae en
  las instrucciones `sdot/udot` (ARMv8.2 dotprod) de los A78: mejor perf/vatio
  que q5 (des-cuantización cara) y que f16 (2× ancho de banda).
- **Modo BATCH estricto**: lotes independientes de 10 s, `no_context=true`.
  **Prohibido el sliding window**: whisper es un transformer **no-causal**
  (cada token atiende sobre todo el mel del lote); solapar ventanas re-infiere
  audio ya procesado → tokens duplicados en las costuras y ~3× de trabajo en
  los Cortex → throttling.
- Térmica: 4 hilos (solo A78), y entre lotes se consulta
  `PowerManager.getThermalHeadroom(10)`; si ≥ 0.90 el motor pausa 5 s.
- JNI blindado: mutex sobre el contexto, `ReleaseFloatArrayElements(JNI_ABORT)`,
  `DeleteLocalRef` por iteración, excepciones Java ante cualquier fallo nativo.

Setup: `git submodule add https://github.com/ggml-org/whisper.cpp app/src/main/cpp/third_party/whisper.cpp`

### Segmentación de pantalla verde — MediaPipe (`ai/GreenScreenSegmenter.kt`)

- `ImageSegmenter` (arquitectura Mobile-UNet .tflite en `assets/models/`) con
  **`Delegate.GPU` explícito**: la inferencia corre en la Mali-G68 (~6-8 ms a
  256²) mientras los Cortex quedan libres para decoder + whisper.
- `RunningMode.VIDEO` con timestamps monótonos (tracking temporal del borde).
- La máscara float32 se cuantiza a **R8** (4× menos ancho de banda de subida,
  filtrable-linear en Mali) y el anti-aliasing del borde se hace en shader
  (`fwidth`), no en CPU.

## 4. Timeline magnética + S Pen

- **DAG** (`timeline/TimelineGraph.kt`): nodos Clip/Effect/Transition/Output,
  validación de aciclicidad *antes* de mutar, orden de render por Kahn,
  snapshots inmutables para undo/redo.
- **Pista magnética** (`MagneticTrack.kt`): las posiciones **se derivan del
  orden** — los huecos y solapes son irrepresentables por construcción.
  Split, ripple-move y snap con umbral constante en pantalla.
- **S Pen** (`input/SPenKeyframeController.kt`): `AXIS_PRESSURE` → longitud de
  tangentes, `AXIS_TILT`×`AXIS_ORIENTATION` → asimetría ease-in/ease-out.
  Procesa el batch histórico completo (digitalizador 360 Hz sobre UI 90 Hz)
  con filtro EMA, y usa `requestUnbufferedDispatch`. Salida directa:
  `BezierEase(x1,y1,x2,y2)` con solver Newton+bisección (`Keyframes.kt`).
- **90 Hz** (`ui/TimelineView.kt`): `requestedFrameRate = HIGH` (API 35),
  `preferredDisplayModeId` al modo de mayor tasa, cero asignaciones en
  `onDraw`, Choreographer solo mientras hay animación.

## 5. Exportación headless

- `ExportWorker` (CoroutineWorker) promovido a **FGS `mediaProcessing`**
  (Android 15: hasta 6 h de proceso multimedia garantizado) con progreso real.
- La ruta por defecto es el **motor nativo** (`TranscodeEngine`): encode
  físico HEVC/AVC en el MFC del Exynos 1380 en CBR, salida directa a
  MediaStore (`Movies/Vinki`) vía FileDescriptor — el video exportado aparece
  en la Galería. Cero binarios externos.
- Ruta FFmpeg opcional (`FfmpegCommandBuilder.kt`), para pipelines complejos
  de mux multi-pista:

```
ffmpeg -y -i in.mp4 -c:v hevc_mediacodec -bitrate_mode cbr -b:v 20000000 \
       -fps_mode cfr -r 60 -g 60 -c:a aac -b:a 256000 -movflags +faststart out.mp4
```

  `h264_mediacodec` / `hevc_mediacodec` fuerzan la codificación **física** en
  el MFC (FFmpeg solo orquesta demux/filtros/mux). ffmpeg-kit fue retirado de
  Maven Central (2025): si se quiere esta ruta, vendorizar el AAR
  `full-gpl-6.0-2` en `app/libs/` y añadir la dependencia comentada en
  `app/build.gradle.kts`.

## 6. Auto-depuración

- `StrictMode` completo en debug (I/O en main thread, Closeables filtrados,
  leaks de Activity) con `penaltyLog`.
- Todos los hilos del motor propagan errores a un `AtomicReference` con
  `failOnce` (primera causa gana), liberación idempotente y sin deadlocks:
  semáforos con `tryAcquire` + timeout, latches con timeout, teardown GL
  ejecutado en el propio hilo GL.
- Validaciones de dominio (`require`/`check`) en todos los constructores de
  modelos; null-safety estricta (cero `!!` en el módulo).

## Cómo obtener e instalar la app (sin PC — desde la tablet)

El repo incluye CI (`.github/workflows/build-editor-apk.yml`) que compila el
APK en GitHub Actions, clonando whisper.cpp y descargando el modelo de
segmentación automáticamente:

1. En el navegador de la tablet: `github.com/toorulalo/Vinki` → pestaña
   **Actions** → workflow **"Build Vinki Video Editor APK"** → **Run
   workflow** (rama `claude/android-video-editor-exynos-3a9nki`). También se
   dispara solo con cada push a esa rama.
2. Cuando el run termine (~10-15 min), abrir el run → sección **Artifacts**
   → descargar `vinki-video-editor-apk` (un .zip con `app-debug.apk`).
3. Descomprimir e instalar el APK (Ajustes → permitir "instalar apps
   desconocidas" para el navegador/Mis archivos).

### Uso de la app

- **+ Video** (repetible) → cada clip se añade a la timeline magnética y se
  previsualiza en bucle. La exportación renderiza TODA la timeline en un solo
  MP4 con PTS continuos y **audio incluido** (passthrough AAC sin pérdida).
- **Subtítulos IA** → extrae el audio, lo transcribe on-device con whisper
  (lotes de 10s, modelo q8_0 incluido en el APK) y abre un editor: toca
  cualquier subtítulo para corregirlo; al exportar se **queman** en el video
  (texto con contorno, compuesto en GPU).
- **Chroma key** → recorte HSV + de-spill en la exportación (pantalla verde).
- **Transiciones** → whip-pan con motion blur direccional en cada juntura
  entre clips (rampa de ±220ms alrededor del corte).
- **Exportar** → motor de 3 hilos (HEVC CBR por hardware) en segundo plano
  con notificación; el resultado aparece en **Galería → Movies/Vinki**.
- La timeline se arrastra con el dedo (imantado a junturas); el S Pen esculpe
  curvas de easing (presión = intensidad, inclinación = asimetría in/out).

### Build local (opcional, con PC)

- JDK 17, Android SDK 35, NDK r27, CMake 3.22; `gradle :app:assembleDebug`
  desde `android-video-editor/`.
- whisper.cpp en `app/src/main/cpp/third_party/whisper.cpp` (si falta, el
  APK compila igual con el ASR deshabilitado). El modelo `ggml-base-q8_0.bin`
  va en `app/src/main/assets/models/` (el CI lo descarga de Hugging Face;
  la app lo copia a filesDir en el primer uso).
- Modelo de segmentación `.tflite` en `app/src/main/assets/models/`
  (`selfie_segmenter.tflite`; si falta, el chroma key funciona solo por color).
- (Opcional) `glslangValidator`, `spirv-opt`, `spirv-cross` en el PATH del
  host para el AOT de shaders; sin ellos, los GLSL fuente compilan online con
  caché `glProgramBinary`.
