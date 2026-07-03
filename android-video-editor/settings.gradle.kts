pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // ffmpeg-kit (retirado de Maven Central en 2025) se consume como AAR local:
        // colocar ffmpeg-kit-full-gpl-6.0-2.aar en app/libs/
        flatDir { dirs("app/libs") }
    }
}

rootProject.name = "VinkiVideoEditor"
include(":app")
