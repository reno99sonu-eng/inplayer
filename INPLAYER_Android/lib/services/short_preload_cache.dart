import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:video_player/video_player.dart';

import '../models/short.dart';
import 'video_service.dart';

/// A pre-warmed controller (and its optional muted soundtrack player) for
/// one short, ready to be handed off to a ShortPlayerWidget instead of that
/// widget cold-starting its own from scratch.
class PreloadedShort {
  final VideoPlayerController controller;
  final AudioPlayer? audioPlayer;
  const PreloadedShort({required this.controller, this.audioPlayer});
}

/// Preloads the next short's video controller directly, independent of
/// whatever ShortsPage's PageView decides to build ahead of time.
///
/// The first attempt at this feature tried to lean on Flutter's own
/// PageView caching (`allowImplicitScrolling`) to get the *widget* for the
/// next short built early, so it could run its own preload logic before
/// becoming visible. That didn't actually work: `allowImplicitScrolling`'s
/// documented purpose is accessibility scroll semantics, not pre-building
/// off-screen widgets, and whatever it does under the hood in this app's
/// Flutter version wasn't reliably building the next ShortPlayerWidget
/// ahead of the swipe — the flash kept happening on every short, not just
/// the first, because the "preload" never actually started until the
/// widget itself got built, which was too late to matter.
///
/// This preloads at a level PageView's build scheduling can't get in the
/// way of: as soon as ShortsPage knows which short is next, it calls
/// [preload] directly — a plain async call tied to the current index in
/// ShortsPage's own State, with zero dependency on when or whether Flutter
/// decides to build that short's widget. When ShortPlayerWidget eventually
/// does get built (on swipe), it asks [take] "is there already a warm
/// controller for me?" and adopts it instead of starting over.
class ShortPreloadCache {
  ShortPreloadCache._();
  static final ShortPreloadCache instance = ShortPreloadCache._();

  String? _preloadingId;
  String? _readyId;
  PreloadedShort? _ready;

  /// Starts warming [short]'s controller in the background. No-ops if this
  /// exact short is already preloaded or currently preloading. Only one
  /// short is ever kept warm at a time — matching the "just the very next
  /// short" scope this feature has always had — so warming a new one first
  /// discards whichever previous one was ready but never claimed.
  void preload(Short short) {
    final id = short.videoId;
    if (id.isEmpty) return;
    if (_readyId == id || _preloadingId == id) return;

    _discardReady();
    _preloadingId = id;
    _warm(short).then((result) {
      if (_preloadingId == id) {
        _preloadingId = null;
        if (result != null) {
          _readyId = id;
          _ready = result;
        }
      } else {
        // Superseded by a newer preload() call before this one finished —
        // don't let a stale, unwanted result linger and leak a decoder.
        result?.controller.dispose();
        result?.audioPlayer?.dispose();
      }
    });
  }

  /// Removes and returns the preloaded controller/audio pair for
  /// [videoId], if one is ready and matches. The caller now owns disposing
  /// it — this is "take", not "peek": the same warm controller is never
  /// handed out twice, and a widget that decides not to use it (see the
  /// mounted/isActive re-check right after calling this) is responsible
  /// for disposing what it took.
  PreloadedShort? take(String videoId) {
    if (_readyId != videoId) return null;
    final result = _ready;
    _readyId = null;
    _ready = null;
    return result;
  }

  /// Releases anything currently preloaded or in-flight, regardless of
  /// which short it's for. Call this when leaving the Raftaar feed
  /// entirely, so an unclaimed warm controller doesn't sit around holding
  /// a decoder open for no reason.
  void discardAll() {
    _preloadingId = null;
    _discardReady();
  }

  void _discardReady() {
    _ready?.controller.dispose();
    _ready?.audioPlayer?.dispose();
    _readyId = null;
    _ready = null;
  }

  Future<PreloadedShort?> _warm(Short short) async {
    try {
      String? videoUrl;
      final playbackId = short.muxPlaybackId;
      if (playbackId != null && playbackId.isNotEmpty) {
        videoUrl = 'https://stream.mux.com/$playbackId.m3u8?max_resolution=720p';
      } else if (short.videoId.isNotEmpty) {
        // Same fallback VideoService() carries in every other spot that
        // needs it outside a widget's own `ref` — its provider just does
        // `Provider<VideoService>((ref) => VideoService())`, and the class
        // itself holds no per-instance state beyond a Dio client and
        // logger, so constructing it directly here is equivalent.
        final video = await VideoService().getVideoById(short.videoId);
        if (video != null &&
            video.muxPlaybackId != null &&
            video.muxPlaybackId!.isNotEmpty) {
          videoUrl =
              'https://stream.mux.com/${video.muxPlaybackId}.m3u8?max_resolution=720p';
        }
      }
      if (videoUrl == null) return null;

      final controller = VideoPlayerController.networkUrl(
        Uri.parse(videoUrl),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );

      AudioPlayer? audioPlayer;
      if (short.soundtrack != null && short.soundtrack!.url.isNotEmpty) {
        final audio = AudioPlayer();
        audioPlayer = audio;
        await audio.setReleaseMode(ReleaseMode.loop);
        await audio.setSourceUrl(short.soundtrack!.url);
        controller.setVolume(0.0);
      } else {
        controller.setVolume(1.0);
      }

      await controller.initialize();
      controller.setLooping(true);
      // Same pre-warm + wall-clock floor used by ShortPlayerWidget's own
      // cold-start path — forces a real decoded frame onto the texture
      // ahead of time so there's nothing left to flash once this
      // controller gets adopted.
      try {
        await controller.seekTo(const Duration(milliseconds: 1));
      } catch (_) {}
      await Future.delayed(const Duration(milliseconds: 100));

      return PreloadedShort(controller: controller, audioPlayer: audioPlayer);
    } catch (e) {
      debugPrint('[ShortPreloadCache] preload failed: $e');
      return null;
    }
  }
}
