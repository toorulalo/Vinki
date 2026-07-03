cmake_minimum_required(VERSION 3.22)
project(vinkivideo LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================================================
# whisper.cpp — ASR on-device (modelo ggml-base-q8_0.bin recomendado)
#
#   git submodule add https://github.com/ggml-org/whisper.cpp third_party/whisper.cpp
#
# Flags para el Exynos 1380 (4x Cortex-A78 + 4x A55, ARMv8.2-A):
#   dotprod  → sdot/udot: producto punto INT8 en 1 instrucción; es la ruta
#              caliente de los pesos q8_0 (≈3x sobre la ruta genérica NEON).
#   fp16     → aritmética half en los acumuladores intermedios.
# GGML_NATIVE=OFF: nada de -march=native en cross-compile; la arquitectura
# viene fijada por GGML_CPU_ARM_ARCH desde build.gradle.kts.
# ============================================================================
set(WHISPER_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_SERVER   OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS      OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP            OFF CACHE BOOL "" FORCE)  # hilos propios de ggml; OpenMP pelea con el scheduler EAS

add_subdirectory(
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/whisper.cpp
    ${CMAKE_CURRENT_BINARY_DIR}/whisper_build
    EXCLUDE_FROM_ALL
)

add_library(vinki_whisper SHARED whisper_jni.cpp)

target_include_directories(vinki_whisper PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/whisper.cpp/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/whisper.cpp/ggml/include
)

find_library(log-lib log)
target_link_libraries(vinki_whisper whisper ${log-lib})

target_compile_options(vinki_whisper PRIVATE -O3 -ffast-math -fvisibility=hidden)

# ============================================================================
# PIPELINE AOT DE SHADERS: GLSL → SPIR-V → ESSL optimizado
#
# ¿Por qué SPIR-V si GLES 3.0 no lo ingiere? Tres razones:
#   1. VALIDACIÓN AOT: glslangValidator rompe el build ante un shader
#      inválido — el error aparece en CI, no como pantalla negra en el device.
#   2. OPTIMIZACIÓN AOT: spirv-opt -O hace inlining, DCE, y constant folding
#      que el compilador online del driver Mali (que corre en la CPU y compite
#      con el hilo de UI) ya no tiene que hacer.
#   3. FUTURO VULKAN: el .spv resultante se carga tal cual el día que el
#      backend migre a Vulkan (la Mali-G68 es Vulkan 1.3). El coste hoy es 0.
#
# En runtime GLES, el ESSL ya optimizado se compila UNA vez y se persiste como
# binario nativo Mali vía glGetProgramBinary (ver GlProgram.kt). Resultado:
# cero compilación de shaders en caliente a partir del segundo arranque.
#
# Herramientas: glslangValidator, spirv-opt y spirv-cross vienen en el
# paquete "shader tools" del Android NDK / Vulkan SDK del host.
# ============================================================================
find_program(GLSLANG_VALIDATOR glslangValidator)
find_program(SPIRV_OPT spirv-opt)
find_program(SPIRV_CROSS spirv-cross)

if(GLSLANG_VALIDATOR AND SPIRV_OPT AND SPIRV_CROSS)
    set(SHADER_SRC_DIR  ${CMAKE_CURRENT_SOURCE_DIR}/../assets/shaders)
    set(SHADER_OUT_DIR  ${CMAKE_CURRENT_SOURCE_DIR}/../assets/shaders/compiled)
    file(MAKE_DIRECTORY ${SHADER_OUT_DIR})

    file(GLOB SHADER_SOURCES ${SHADER_SRC_DIR}/*.frag ${SHADER_SRC_DIR}/*.vert)

    set(COMPILED_SHADERS "")
    foreach(SHADER ${SHADER_SOURCES})
        get_filename_component(NAME ${SHADER} NAME)
        set(SPV  ${CMAKE_CURRENT_BINARY_DIR}/${NAME}.spv)
        set(ESSL ${SHADER_OUT_DIR}/${NAME})

        add_custom_command(
            OUTPUT ${ESSL}
            # -G: semántica OpenGL (no Vulkan) para poder cruzar de vuelta a ESSL.
            COMMAND ${GLSLANG_VALIDATOR} -G ${SHADER} -o ${SPV}
            COMMAND ${SPIRV_OPT} -O ${SPV} -o ${SPV}
            COMMAND ${SPIRV_CROSS} ${SPV} --es --version 300 --output ${ESSL}
            DEPENDS ${SHADER}
            COMMENT "AOT shader: ${NAME} → SPIR-V → spirv-opt → ESSL300"
            VERBATIM
        )
        list(APPEND COMPILED_SHADERS ${ESSL})
    endforeach()

    add_custom_target(shaders_aot ALL DEPENDS ${COMPILED_SHADERS})
else()
    message(WARNING
        "glslang/spirv-tools no encontrados: se omite AOT de shaders. "
        "Los GLSL fuente de assets/shaders/ se compilarán online (con caché "
        "glProgramBinary a partir del primer arranque).")
endif()
