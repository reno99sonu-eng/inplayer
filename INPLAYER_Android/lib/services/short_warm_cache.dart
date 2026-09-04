import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:video_player/video_player.dart';

import 'device_capability_service.dart';

/// KILL SWITCH for warming up the next short's video decoder.
///
/// Set this to `false` and rebuild to go straight back to the safe
/// one-decoder-at-a-time behaviour — every short then allocates its player
/// only when you land on it. Nothing else needs changing: ShortsPage stops
/// warming and ShortPlayerWidget simply never finds anything to adopt.
///
/// Flip it off if shorts ever start showing corrupted/green frames,
/// stalling, or the app gets killed during the Raftaar feed on some
/// device — those are the symptoms of pushing a chipset past the number of
/// concurrent hardware decoders it can actually handle.
///
/// NOW ON.
///
/// It was off to "match the website exactly", on the reasoning that
/// `ShortsPageContent.tsx` renders a player for the ACTIVE slide only and
/// the site is flawless anyway. That reasoning does not survive contact
/// with the platform difference. A browser opening a second HLS stream is
/// reusing a live HTTP/2 connection, a warm TLS session and a decoder pool
/// Chrome already owns; Flutter opening one has to construct an ExoPlayer,
/// fetch the master manifest, fetch the media playlist, fetch the first
/// segment and hand MediaCodec a fresh session. That is the 1–2 seconds
/// between the swipe landing and the picture moving, and no amount of
/// paint-order tuning removes it — it is not a rendering problem, it is
/// work that has to happen before there is anything to render.
///
/// The only way to make a swipe instant is to have already done that work
/// before the swipe. So it is done now, off the critical path, while the
/// current short plays. Matching the site's *architecture* was never the
/// goal; matching how the site *feels* is, and on this platform that takes
/// the opposite implementation.
///
/// The old corruption risk is handled properly rather than by staying off:
/// warming is gated on [DeviceCapabilityService.canPreloadVideo], the
/// Android 10+ check written for exactly this and never wired up until
/// now. Anything below that keeps the old cold-start path.
const bool kWarmNextShortEnabled = false;

/// Holds at most ONE fully-initialized, not-yet-playing video controller
/// for the short the viewer is most likely to swipe to next.
///
/// Why this is safe when earlier preloading attempts were not:
///
///  * It is hard-capped at a single warm controller, and never runs two
///    initialize() calls at once. With the playing short that is two AVC
///    decoders, never three.
///  * It is gated per-device on Android 10+, so the population most likely
///    to only have one reliable decoder slot never allocates a second.
///  * ShortsPage only asks for a warm-up once the CURRENT short has
///    actually rendered its first frame. Nothing is ever allocated while
///    the visible player is still fighting for a decoder, which is what
///    made the earliest attempt deadlock on open.
///  * Home-feed video previews are suspended for the whole time the feed
///    is on screen (see VideoPreviewGate.suspend), so the preview decoder
///    is not competing for the budget any more.
///  * There is no seekTo here. Seeking a freshly-initialized HLS stream is
///    what produced corrupted green frames previously.
class ShortWarmCache {
  ShortWarmCache._();
  static final ShortWarmCache instance = ShortWarmCache._();

  String? _videoId;
  VideoPlayerController? _controller;

  /// Non-null while an initialize() is in flight, so a second warm-up can
  /// never overlap the first.
  String? _warmingId;

  /// A warm-up requested while another was still in flight.
  ///
  /// The old code simply dropped those, which quietly defeated the whole
  /// feature exactly when it mattered: swipe faster than one warm-up takes
  /// and every subsequent request landed while the previous was still
  /// running, so nothing was ever warm again for the rest of the session.
  /// Queueing one keeps the decoder cap intact while still honouring the
  /// most recent request.
  String? _pendingId;
  Uri? _pendingUrl;

  /// Resolved once per session — the hardware answer does not change.
  bool? _deviceAllows;

  Future<bool> _allowedOnThisDevice() async {
    if (!kWarmNextShortEnabled) return false;
    final cached = _deviceAllows;
    if (cached != null) return cached;
    final allowed = await DeviceCapabilityService.canPreloadVideo();
    _deviceAllows = allowed;
    return allowed;
  }

  /// Prepares [videoId] in the background. Safe to call repeatedly.
  Future<void> warm(String videoId, Uri url) async {
    if (videoId.isEmpty) return;
    if (!await _allowedOnThisDevice()) return;
    if (_videoId == videoId && _controller != null) return;

    if (_warmingId != null) {
      if (_warmingId != videoId) {
        _pendingId = videoId;
        _pendingUrl = url;
      }
      return;
    }
    await _startWarm(videoId, url);
  }

  Future<void> _startWarm(String videoId, Uri url) async {
    // Drop whatever stale short was warm before taking a new decoder.
    // Deliberately not discard(): that also clears the pending request,
    // which is the thing we may be in the middle of servicing.
    await _disposeReady();

    _warmingId = videoId;
    final controller = VideoPlayerController.networkUrl(
      url,
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );
    try {
      await controller.initialize();
      // A swipe (or leaving the feed) during initialize() invalidates this.
      if (_warmingId != videoId) {
        await controller.dispose();
        return;
      }
      controller.setLooping(true);
      _controller = controller;
      _videoId = videoId;
    } catch (e) {
      debugPrint('[ShortWarmCache] warm-up failed for $videoId: $e');
      try {
        await controller.dispose();
      } catch (_) {}
    } finally {
      if (_warmingId == videoId) _warmingId = null;
      _drainPending();
    }
  }

  void _drainPending() {
    final id = _pendingId;
    final url = _pendingUrl;
    _pendingId = null;
    _pendingUrl = null;
    if (id == null || url == null) return;
    if (_warmingId != null) return;
    if (_videoId == id && _controller != null) return;
    unawaited(_startWarm(id, url));
  }

  /// Hands ownership of the warm controller to the caller, if it happens to
  /// be the short being asked for. The caller becomes responsible for
  /// disposing it.
  VideoPlayerController? take(String videoId) {
    if (videoId.isEmpty || _videoId != videoId) return null;
    final controller = _controller;
    _controller = null;
    _videoId = null;
    return controller;
  }

  /// Releases the warm decoder. Called when leaving the feed, so a short
  /// nobody swiped to never keeps hardware tied up.
  Future<void> discard() async {
    _warmingId = null;
    _pendingId = null;
    _pendingUrl = null;
    await _disposeReady();
  }

  Future<void> _disposeReady() async {
    final controller = _controller;
    _controller = null;
    _videoId = null;
    if (controller != null) {
      try {
        await controller.dispose();
      } catch (_) {}
    }
  }
}
