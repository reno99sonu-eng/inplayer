import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../models/short.dart';
import '../models/video.dart';

/// What was minimized — which decides the window's shape and how "restore"
/// gets back to the full-size player.
enum MiniPlayerKind {
  /// A normal 16:9 watch-page video. Restoring hands the *same* controller
  /// straight back to WatchPage, so playback continues from exactly where it
  /// was with no re-buffer.
  video,

  /// A vertical Raftaar short. Restoring navigates back into the shorts feed
  /// at that video — see [restoreRoute] and the note on [close].
  short,
}

/// Holds whatever video is currently floating in the small corner window, so
/// it survives the screen it was started from being popped or backgrounded.
/// The video counterpart to MusicPlayerService's role for audio.
///
/// The controller is *adopted*, never recreated — that is the whole point.
/// Minimizing must not restart or re-buffer what is already playing.
class VideoMiniPlayerService extends ChangeNotifier {
  VideoPlayerController? _controller;

  /// Raftaar shorts with a picked soundtrack mute the video and play the
  /// track through a separate audioplayers instance (see
  /// short_player_widget.dart). Both have to travel together or the window
  /// plays silent video while the music keeps going on a dead page.
  AudioPlayer? _audio;

  Video? _video;
  MiniPlayerKind _kind = MiniPlayerKind.video;
  String _title = '';
  String _restoreRoute = '/';
  String _artUrl = '';

  VideoPlayerController? get controller => _controller;

  /// Only set for [MiniPlayerKind.video] — shorts carry a `Short`, not a
  /// `Video`, and everything the window actually renders is exposed as the
  /// plain fields below so the widget doesn't need to care which it is.
  Video? get video => _video;

  MiniPlayerKind get kind => _kind;
  String get title => _title;

  /// Where "tap to expand" should go. `/watch/:id` for a video (which also
  /// receives the live controller via go_router's `extra`), `/shorts/:id`
  /// for a short.
  String get restoreRoute => _restoreRoute;

  /// Non-empty only when the raw decoded frame isn't meaningful art — i.e.
  /// music tracks, which render as MusicStage rather than VideoPlayer at
  /// full size, so their video frame is typically blank.
  String get artUrl => _artUrl;

  /// Shorts are 9:16; watch-page videos are 16:9. Drives the window's shape.
  bool get isPortrait => _kind == MiniPlayerKind.short;

  bool get isActive => _controller != null;

  void _adopt(VideoPlayerController controller, AudioPlayer? audio) {
    // Replacing one minimized video with another: tear the old one down
    // first, or its player leaks and keeps decoding in the background.
    if (_controller != null && _controller != controller) {
      _controller!.dispose();
    }
    if (_audio != null && _audio != audio) {
      _audio!.stop();
      _audio!.dispose();
    }
    _controller = controller;
    _audio = audio;
  }

  /// Minimize a watch-page video.
  void activate({
    required VideoPlayerController controller,
    required Video video,
  }) {
    _adopt(controller, null);
    _video = video;
    _kind = MiniPlayerKind.video;
    _title = video.title;
    _restoreRoute = '/watch/${video.videoId}';
    _artUrl = video.isMusic
        ? (video.covers.isNotEmpty ? video.covers.first : video.thumbnail)
        : '';
    notifyListeners();
  }

  /// Minimize a Raftaar short, along with its soundtrack player if it has
  /// one.
  void activateShort({
    required VideoPlayerController controller,
    AudioPlayer? soundtrack,
    required Short short,
  }) {
    _adopt(controller, soundtrack);
    _video = null;
    _kind = MiniPlayerKind.short;
    _title = short.title;
    _restoreRoute = '/shorts/${short.videoId}';
    _artUrl = '';
    notifyListeners();
  }

  /// Hand the live controller back to a full-size player without disposing
  /// it. Only meaningful for [MiniPlayerKind.video]: WatchPage takes it via
  /// its `adoptController` param and carries on mid-playback.
  VideoPlayerController? detachForRestore() {
    final c = _controller;
    _controller = null;
    _audio = null;
    _video = null;
    if (c != null) notifyListeners();
    return c;
  }

  /// Stop and tear everything down.
  ///
  /// Also the restore path for a short: `ShortPlayerWidget` builds and owns
  /// its own controller per card and there is no seam to inject an existing
  /// one, so re-entering the feed means a fresh controller and the short
  /// starts over. That is a real, accepted limitation rather than an
  /// oversight — threading an adopted controller through the PageView's card
  /// lifecycle would be a much larger change than the feature is worth, and
  /// a short restarting costs seconds where a long video restarting would
  /// cost the viewer their place.
  void close() {
    _controller?.pause();
    _controller?.dispose();
    _audio?.stop();
    _audio?.dispose();
    _controller = null;
    _audio = null;
    _video = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _controller?.dispose();
    _audio?.dispose();
    super.dispose();
  }
}

final videoMiniPlayerServiceProvider =
    ChangeNotifierProvider<VideoMiniPlayerService>((ref) {
  final service = VideoMiniPlayerService();
  ref.onDispose(service.dispose);
  return service;
});
