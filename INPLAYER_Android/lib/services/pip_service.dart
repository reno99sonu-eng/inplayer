import 'package:flutter/services.dart';

/// Real Android system Picture-in-Picture, via a hand-written platform
/// channel to MainActivity.kt — there is no Flutter/pub.dev core API for
/// this, the same as every real PiP-capable Flutter video app. Every method
/// here is defensive: on a platform/OS version that doesn't support it
/// (anything pre-Android 7.0, or a platform other than Android — this
/// channel is Android-only, matching the manifest's own
/// `supportsPictureInPicture` flag which is Android-specific), calls
/// safely return false / no-op instead of throwing, so callers never need
/// their own try/catch.
class PipService {
  PipService._();

  static const MethodChannel _channel = MethodChannel('inplayer.app/pip');

  /// Whether the OS + this build actually support entering PiP right now.
  static Future<bool> isSupported() async {
    try {
      final result = await _channel.invokeMethod<bool>('isPipSupported');
      return result ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Asks the OS to enter Picture-in-Picture immediately, with the video's
  /// real aspect ratio (Android clamps this to its own supported range
  /// natively, so an unusual ratio just falls back safely rather than
  /// crashing — see MainActivity.kt). Returns whether the request was made;
  /// the OS can still decline for its own reasons even when this is true.
  static Future<bool> enter({int width = 16, int height = 9}) async {
    try {
      final result = await _channel.invokeMethod<bool>('enterPip', {
        'width': width,
        'height': height,
      });
      return result ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Tells the native side whether a video is currently actively playing
  /// *and* the viewer has opted in to auto-PiP (Settings > Playback >
  /// Picture in Picture) — purely so MainActivity's onUserLeaveHint() (Home
  /// button / app switch) knows whether to auto-enter PiP this time. The
  /// manual PiP button bypasses this entirely and always calls enter()
  /// directly. Safe to call often; failures are silently ignored.
  static Future<void> setPlaybackActive(bool active) async {
    try {
      await _channel.invokeMethod<void>('setPlaybackActive', {'active': active});
    } catch (_) {
      // Best-effort — a failed call here just means auto-PiP-on-leave won't
      // fire this time, never a crash.
    }
  }

  /// Fires whenever the native Activity actually enters/exits PiP, so the
  /// app can switch to (or back from) a minimal, chrome-free layout — the
  /// floating PiP window is far too small for the normal player controls,
  /// and Android itself overlays its own play/pause/close buttons on top of
  /// whatever the app renders while floating. Only one listener is active
  /// at a time (registering a new one replaces the previous), matching how
  /// this is used — only the currently-visible watch page needs it.
  static void setPipModeChangedListener(void Function(bool isInPip) onChanged) {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onPipModeChanged') {
        onChanged(call.arguments as bool? ?? false);
      }
    });
  }
}
