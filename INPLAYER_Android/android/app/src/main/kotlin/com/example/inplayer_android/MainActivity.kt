package com.example.inplayer_android

import android.app.PictureInPictureParams
import android.content.res.Configuration
import android.os.Build
import android.util.Rational
import com.ryanheise.audioservice.AudioServiceActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

// Real Android system Picture-in-Picture, wired up as a small platform
// channel to lib/services/pip_service.dart. Flutter has no core API for
// this — it is genuinely native-only, same as every real PiP-capable
// Flutter video app on the Play Store. Everything here is defensive and
// version-gated: on anything below Android 7.0 (API 24, the first OS
// version PiP exists at all) every method is a safe no-op, matching
// PipService's own "never throw, just return false/do nothing" contract on
// the Dart side.
class MainActivity : AudioServiceActivity() {
    private val pipChannelName = "inplayer.app/pip"
    private var pipChannel: MethodChannel? = null

    // Set from Dart (see PipService.setPlaybackActive) whenever the watch
    // page's video is actually playing AND the viewer has "Picture in
    // Picture" turned on in Settings > Playback — onUserLeaveHint() below
    // only auto-enters PiP when this is true, so pressing Home while just
    // browsing (not watching) or with the preference off never triggers it.
    private var isPlaybackActive = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, pipChannelName)
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "isPipSupported" -> {
                    result.success(Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)
                }
                "enterPip" -> {
                    val width = call.argument<Int>("width") ?: 16
                    val height = call.argument<Int>("height") ?: 9
                    result.success(enterPip(width, height))
                }
                "setPlaybackActive" -> {
                    isPlaybackActive = call.argument<Boolean>("active") ?: false
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
        pipChannel = channel
    }

    // Builds a PictureInPictureParams with the video's real aspect ratio
    // when possible (Android requires it fall inside roughly 1:2.39 to
    // 2.39:1 — anything outside that range, or a version below API 26 where
    // aspect-ratio params don't exist yet, falls back to a safe plain 16:9
    // PiP window rather than crashing).
    private fun enterPip(width: Int, height: Int): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false
        return try {
            val ratio = if (height != 0) width.toDouble() / height.toDouble() else 16.0 / 9.0
            val safeWidth: Int
            val safeHeight: Int
            if (ratio in 0.42..2.39) {
                safeWidth = width
                safeHeight = height
            } else {
                safeWidth = 16
                safeHeight = 9
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(safeWidth, safeHeight))
                    .build()
                enterPictureInPictureMode(params)
            } else {
                @Suppress("DEPRECATION")
                enterPictureInPictureMode()
            }
            true
        } catch (e: Exception) {
            // A device can still refuse (low memory, policy, etc.) even when
            // it reports support — never let that crash the app.
            false
        }
    }

    // Fired by the OS when the user leaves the app (Home button, recents,
    // switching apps) — the standard Android trigger every real video app's
    // "auto PiP on background" behavior hooks into.
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (isPlaybackActive) {
            enterPip(16, 9)
        }
    }

    // Notifies the Dart side so the watch page can swap to its minimal,
    // chrome-free PiP layout (and pop out of the landscape fullscreen page
    // if that's what was showing) the moment the floating window actually
    // opens or closes.
    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        pipChannel?.invokeMethod("onPipModeChanged", isInPictureInPictureMode)
    }
}
