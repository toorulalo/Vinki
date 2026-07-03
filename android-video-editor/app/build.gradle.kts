plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.vinki.videoeditor"
    compileSdk = 35
    ndkVersion = "27.1.12297006"

    defaultConfig {
        applicationId = "com.vinki.videoeditor"
        // Objetivo único: Galaxy Tab S10 Lite (Android 15 / API 35). minSdk 34 da un
        // margen de una versión sin renunciar a mediaProcessing FGS ni a las APIs de 90Hz.
        minSdk = 34
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        ndk {
            // Exynos 1380 = 4x Cortex-A78 + 4x Cortex-A55, exclusivamente arm64.
            abiFilters += listOf("arm64-v8a")
        }

        externalNativeBuild {
            cmake {
                cppFlags += listOf("-std=c++17", "-fexceptions", "-frtti")
                arguments += listOf(
                    "-DANDROID_STL=c++_shared",
                    "-DGGML_NATIVE=OFF",
                    // ARMv8.2-A con dotprod+fp16: ruta SIMD óptima para ggml en los A78.
                    "-DGGML_CPU_ARM_ARCH=armv8.2-a+dotprod+fp16"
                )
            }
        }
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures {
        buildConfig = true // VideoEditorApp usa BuildConfig.DEBUG para StrictMode
    }

    packaging {
        jniLibs {
            // whisper.cpp + ffmpeg-kit comparten libc++_shared: quedarse con una sola copia.
            pickFirsts += "**/libc++_shared.so"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Pipeline de exportación headless (WorkManager + notificación FGS mediaProcessing).
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // Segmentación on-device (Mobile-UNet vía ImageSegmenter + GPU Delegate en la Mali-G68).
    implementation("com.google.mediapipe:tasks-vision:0.10.20")

    // Nota: la exportación usa el motor MediaCodec nativo (TranscodeEngine) —
    // mismo encode físico en el MFC del Exynos, sin binarios externos.
    // La ruta FFmpeg (FfmpegCommandBuilder) queda como integración opcional:
    // si se vendoriza un AAR de ffmpeg-kit en app/libs/, añadir aquí
    // implementation(files("libs/ffmpeg-kit-full-gpl-6.0-2.aar")).
}
