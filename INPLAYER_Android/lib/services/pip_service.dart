import 'dart:async';

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

  // Several watch pages can be alive at once (one pushed over another), so
  // PiP state is tracked per page instead of in one global slot. The old
  // single "last one registered wins" handler was never cleared on dispose:
  // after a stacked watch page was popped, the native "entered PiP" event
  // went to that dead page, the visible one never switched to its bare-video
  // layout, and its full player chrome rendered inside the PiP window —
  // overlapping, and untappable because PiP never delivers touches to app
  // content. Likewise a page's dispose used to force the auto-PiP flag off
  // even while the page underneath was still playing.
  static final List<_PipOwner> _owners = [];
  static bool _handlerInstalled = false;
  static bool? _lastSentActive;

  /// Registers a watch page. Only the most recently registered live page
  /// (the top-most one) is told when the Activity enters/exits PiP, since
  /// that is the page actually on screen. Pair with [unregister] in dispose.
  static void register(Object owner, void Function(bool isInPip) onModeChanged) {
    _installHandler();
    _owners.removeWhere((o) => identical(o.owner, owner));
    _owners.add(_PipOwner(owner, onModeChanged));
  }

  /// Removes a disposed page and re-reports auto-PiP from the pages that
  /// remain (false when none do, so a closed page never leaves a stale
  /// "playing" flag that could trigger a phantom PiP later).
  static void unregister(Object owner) {
    _owners.removeWhere((o) => identical(o.owner, owner));
    _pushActive();
  }

  /// Whether [owner] currently wants Home/app-switch to auto-enter PiP. The
  /// native flag is the OR across all registered pages.
  static void setActive(Object owner, bool active) {
    for (final o in _owners) {
      if (identical(o.owner, owner)) o.active = active;
    }
    _pushActive();
  }

  static void _pushActive() {
    final any = _owners.any((o) => o.active);
    if (any == _lastSentActive) return;
    _lastSentActive = any;
    unawaited(setPlaybackActive(any));
  }

  static void _installHandler() {
    if (_handlerInstalled) return;
    _handlerInstalled = true;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onPipModeChanged') {
        final isInPip = call.arguments as bool? ?? false;
        if (_owners.isNotEmpty) _owners.last.onModeChanged(isInPip);
      }
    });
  }
}

class _PipOwner {
  _PipOwner(this.owner, this.onModeChanged);

  final Object owner;
  final void Function(bool isInPip) onModeChanged;
  bool active = false;
}
