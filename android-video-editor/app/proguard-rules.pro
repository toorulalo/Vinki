# WhisperSegment se construye por reflexión desde whisper_jni.cpp:
# la firma (JJLjava/lang/String;)V debe sobrevivir a R8.
-keep class com.vinki.videoeditor.ai.WhisperSegment { <init>(long, long, java.lang.String); *; }
-keep class com.vinki.videoeditor.ai.WhisperBridge { *; }

# MediaPipe carga clases por nombre desde JNI.
-keep class com.google.mediapipe.** { *; }
