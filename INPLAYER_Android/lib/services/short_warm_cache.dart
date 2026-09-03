import 'package:flutter/foundation.dart';
import 'package:video_player/video_player.dart';

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
/// NOW OFF, to match the website exactly.
///
/// `ShortsPageContent.tsx` renders a player for the ACTIVE slide only —
/// `const hasRealVideo = isActive && !!short.muxPlaybackId;` — and every
/// other slide is a plain poster image. There is no ±1 window and no
/// neighbour preloading anywhere on the site, so exactly one <video>
/// exists at a time. That is precisely why Raftaar is flawless in the
/// browser: the decoder is never contended.
///
/// Setting this back to true re-enables warming the next short (two
/// decoders, capped) for faster swipes — a deliberate improvement over the
/// site, but a divergence from it.
const bool kWarmNextShortEnabled = false;

/// Holds at most ONE fully-initialized, not-yet-playing video controller
/// for the short the viewer is most likely to swipe to next.
///
/// Why this is safe now when earlier preloading attempts were not:
///
///  * It is hard-capped at a single warm controller, and refuses to start
///    a second warm-up while one is already in flight. With the playing
///    short that is two AVC decoders, never three.
///  * ShortsPage only asks for a warm-up once the CURRENT short has
///    actually rendered its first frame. Nothing is ever allocated while
///    the visible player is still fighting for a decoder, which is what
///    made the previous attempt deadlock on open.
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

  /// Prepares [videoId] in the background. Safe to call repeatedly.
  Future<void> warm(String videoId, Uri url) async {
    if (!kWarmNextShortEnabled || videoId.isEmpty) return;
    // Strictly one warm-up at a time — this is the cap that keeps the
    // concurrent decoder count at two.
    if (_warmingId != null) return;
    if (_videoId == videoId && _controller != null) return;

    // Drop whatever stale short was warm before taking a new decoder.
    await discard();

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
    }
  }

  /// Hands ownership of the warm controller to the caller, if it happens to
  /// be the short being asked for. The caller becomes responsible for
  /// disposing it.
  VideoPlayerController? take(String videoId) {
    if (!kWarmNextShortEnabled) return null;
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
