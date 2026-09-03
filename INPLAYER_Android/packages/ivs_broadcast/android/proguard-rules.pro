# Keep the Amazon IVS Broadcast SDK and its OkHttp runtime dependencies.
# This project is not using a custom R8 keep file elsewhere, and the package's
# transitive AAR is being stripped during release minification unless these
# classes are explicitly preserved.
-keep class com.amazonaws.ivs.** { *; }
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
