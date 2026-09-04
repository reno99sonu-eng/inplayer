import 'dart:async';
import 'dart:async' as async;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../models/short.dart';
import '../../../../models/comment.dart';
import '../../../../services/video_service.dart';
import '../../../../services/like_service.dart';
import '../../../../services/watchlist_service.dart';
import '../../../../services/channel_service.dart';
import '../../../../services/comment_service.dart';
import '../../../../services/short_warm_cache.dart';
import '../../../../services/shorts_mute_state.dart';
import '../../../../services/video_mini_player_service.dart';

/// True once the decoder has genuinely produced moving picture for this
/// controller — real frame dimensions plus a playhead that has actually
/// advanced.
///
/// Deliberately does NOT require `value.isPlaying`. That flag drops to
/// false on every buffering stall, so ANDing it in meant a short that
/// buffered at the wrong moment could sit behind its poster indefinitely
/// — the "stuck, never plays" report. Position advancing past a couple of
/// frames is the honest signal that pictures are flowing; combined with
/// the hard fallback timer in _initPlayer, the reveal can no longer
/// deadlock.
bool shouldRevealShortFrame(VideoPlayerValue value) {
  final size = value.size;
  final hasRealFrame = size.width > 0 && size.height > 0;
  final hasPlaybackProgress = value.position > const Duration(milliseconds: 250);
  return value.isInitialized && hasRealFrame && hasPlaybackProgress;
}

/// Poster/thumbnail URL for a short — the exact derivation the player
/// renders, exposed as a top-level function so the feed can warm these
/// images a page or two ahead (see ShortsPage._precacheUpcomingPosters).
///
/// Sharing one implementation matters: if the prefetch ever computed even
/// a slightly different URL than the one the card actually renders, the
/// prefetch would silently warm the wrong cache entry and the poster would
/// still pop in on arrival.
/// HLS URL for a short, when its Mux playback id is already known.
///
/// Shared with ShortsPage so a warmed-up controller is guaranteed to have
/// been opened on the exact same URL the player would have requested —
/// otherwise the warm-up would quietly prepare the wrong thing.
/// Returns null when the short has no playback id, in which case the
/// player falls back to resolving it via the API and no warm-up happens.
String? shortStreamUrl(Short short) {
  final playbackId = short.muxPlaybackId;
  if (playbackId == null || playbackId.isEmpty) return null;
  return 'https://stream.mux.com/$playbackId.m3u8?max_resolution=720p';
}

String shortPosterUrl(Short short) {
  final poster = short.poster.trim();
  if (poster.isNotEmpty) return poster;
  final playbackId = short.muxPlaybackId;
  if (playbackId != null && playbackId.isNotEmpty) {
    // time=0 and NO forced crop, both deliberate — this is the poster the
    // video has to replace without a visible jump.
    //
    // It used to request `time=1`, i.e. the frame one second IN, while the
    // video starts at 0. So the still on screen was a different moment than
    // the first frame of playback, and the swap visibly cut to another point
    // in the video. The site avoids this by construction: MuxPlayer is given
    // `thumbnailTime={0}`, so its poster IS frame zero.
    //
    // It also forced width=640&height=1138&fit_mode=smartcrop — a 9:16 crop.
    // Shorts are not all 9:16 (logcat shows 720x900 among others), and both
    // poster and video render with BoxFit.cover, so a 4:5 video cropped to
    // 9:16 as a still and then cover-cropped as video framed differently —
    // the picture shifted the instant the video appeared. Asking for a width
    // only lets Mux preserve the source aspect ratio, so the two match.
    return 'https://image.mux.com/$playbackId/thumbnail.webp?width=720&time=0';
  }
  return '';
}

class ShortPlayerWidget extends ConsumerStatefulWidget {
  final Short short;
  final bool isActive;

  /// Height, in logical pixels, of any app chrome overlapping the bottom of
  /// this card — in practice the home shell's bottom navigation bar, which
  /// floats over this page because HomePage's Scaffold sets
  /// `extendBody: true`.
  ///
  /// Every bottom-anchored overlay below (the right action rail, the
  /// channel/caption block, the gradient scrim) is offset by this. Without
  /// it those controls sit at bottom: 24–28 — directly underneath the nav
  /// bar — so the Save button and the channel row were being clipped off
  /// the bottom of the screen, which is what "cropped entirely from below"
  /// was describing. The video frame itself was never actually cropped;
  /// it was occluded.
  ///
  /// Defaults to 0 because the standalone pushed `/shorts` route has no
  /// bottom nav over it — only the tab inside HomePage passes a real value.
  final double bottomInset;

  /// Fired once this short has actually put a frame on screen.
  ///
  /// ShortsPage uses this as the cue to warm up the NEXT short's decoder.
  /// Waiting for a real frame matters: it guarantees a second decoder is
  /// only ever allocated while this one is already playing happily, never
  /// while it is still competing to start.
  final VoidCallback? onFirstFrame;

  /// Fired after this card has handed its player off to the floating mini
  /// window, so the feed can get out of the way — there is no point sitting
  /// on a full-screen shorts feed whose video is now playing in a corner.
  /// Null hides the minimize button entirely, the same on/off-by-presence
  /// pattern PlayerChrome uses for onMinimize and onPipTapped.
  final VoidCallback? onMinimized;

  const ShortPlayerWidget({
    super.key,
    required this.short,
    this.isActive = true,
    this.bottomInset = 0,
    this.onFirstFrame,
    this.onMinimized,
  });

  @override
  ConsumerState<ShortPlayerWidget> createState() => _ShortPlayerWidgetState();
}

class _ShortPlayerWidgetState extends ConsumerState<ShortPlayerWidget>
    with WidgetsBindingObserver {
  VideoPlayerController? _videoController;
  AudioPlayer? _audioPlayer;
  bool _isInitialized = false;
  bool _isFirstFrameRendered = false;
  bool _isPlaying = false;
  bool _showHeartBurst = false;
  int _playerGeneration = 0;
  late final String _posterUrl;
  final ValueNotifier<double> _progressNotifier = ValueNotifier<double>(0.0);

  bool _isLiked = false;
  int _likeCount = 0;
  bool _isSaved = false;
  bool _isSubscribed = false;
  int _commentCount = 0;
  bool _posterPrecached = false;
  async.Timer? _firstFrameRevealTimer;

  /// Hold-to-fast-forward, mirroring the site's `startHold`/`endHold`.
  /// 300ms press engages 2x; release restores 1x.
  async.Timer? _holdTimer;
  bool _speedBoost = false;

  /// The site sets `suppressClickRef.current = true` when a boost ends, so
  /// the click that terminates a hold is not also treated as a tap. Same
  /// idea here — without it, letting go of a fast-forward would toggle
  /// play/pause.
  bool _suppressNextTap = false;

  void _startHold(TapDownDetails _) {
    _holdTimer?.cancel();
    _holdTimer = async.Timer(const Duration(milliseconds: 300), () {
      _holdTimer = null;
      final controller = _videoController;
      if (controller == null || !_isInitialized || !mounted) return;
      controller.setPlaybackSpeed(2.0);
      setState(() => _speedBoost = true);
    });
  }

  void _endHold() {
    _holdTimer?.cancel();
    _holdTimer = null;
    if (!_speedBoost) return;
    _videoController?.setPlaybackSpeed(1.0);
    _suppressNextTap = true;
    if (mounted) setState(() => _speedBoost = false);
  }

  /// True when this short's own audio must stay silent regardless of the
  /// viewer's mute choice, because a creator-picked soundtrack replaces it.
  /// Mirrors the site's `muted={muted || shortHasSoundtrack(short)}`.
  bool get _hasSoundtrack {
    final soundtrack = widget.short.soundtrack;
    return soundtrack != null && soundtrack.url.isNotEmpty;
  }

  void _onMuteChanged() {
    _applyMute();
    if (mounted) setState(() {});
  }

  /// Pushes the global mute choice onto whichever audio this short actually
  /// uses — the video's own track, or the separate soundtrack player.
  void _applyMute() {
    final muted = ShortsMuteState.instance.isMuted;
    if (_hasSoundtrack) {
      // Camera audio stays off permanently for soundtrack shorts; the
      // track itself follows the viewer's choice.
      _videoController?.setVolume(0.0);
      _audioPlayer?.setVolume(muted ? 0.0 : 1.0);
    } else {
      _videoController?.setVolume(muted ? 0.0 : 1.0);
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ShortsMuteState.instance.muted.addListener(_onMuteChanged);
    _initPosterUrl();
    _parseInitialCounts();
    if (widget.isActive) _initPlayer();
    _loadInteractionStatus();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_posterPrecached && _posterUrl.isNotEmpty && !isDataImageUrl(_posterUrl)) {
      _posterPrecached = true;
      precacheImage(CachedNetworkImageProvider(_posterUrl), context);
    }
  }

  void _initPosterUrl() {
    _posterUrl = shortPosterUrl(widget.short);
  }

  void _parseInitialCounts() {
    // Parse likes string (e.g. "12 likes" -> 12)
    final likeMatch = RegExp(r'(\d+)').firstMatch(widget.short.likes);
    if (likeMatch != null) {
      _likeCount = int.tryParse(likeMatch.group(1)!) ?? 0;
    }
    final commentMatch = RegExp(r'(\d+)').firstMatch(widget.short.comments);
    if (commentMatch != null) {
      _commentCount = int.tryParse(commentMatch.group(1)!) ?? 0;
    }
  }

  Future<void> _loadInteractionStatus() async {
    if (widget.short.videoId.isEmpty) return;

    bool? isLiked;
    int? likeCount;
    bool? isSaved;
    bool? isSubscribed;

    await Future.wait([
      (() async {
        try {
          final likeService = ref.read(likeServiceProvider);
          final status = await likeService.getStatus(widget.short.videoId);
          isLiked = status['myReaction'] == 'like';
          if (status['likeCount'] is int) {
            likeCount = status['likeCount'] as int;
          }
        } catch (_) {}
      })(),
      (() async {
        try {
          final watchlistService = ref.read(watchlistServiceProvider);
          isSaved = await watchlistService.isSaved(widget.short.videoId);
        } catch (_) {}
      })(),
      (() async {
        final creatorId = widget.short.uploaderId;
        if (creatorId != null && creatorId.isNotEmpty) {
          try {
            final channelService = ref.read(channelServiceProvider);
            final sub = await channelService.getSubscriptionStatus(creatorId);
            if (sub != null) {
              isSubscribed = sub['isSubscribed'] == true;
            }
          } catch (_) {}
        }
      })(),
    ]);

    if (mounted) {
      setState(() {
        if (isLiked != null) _isLiked = isLiked!;
        if (likeCount != null) _likeCount = likeCount!;
        if (isSaved != null) _isSaved = isSaved!;
        if (isSubscribed != null) _isSubscribed = isSubscribed!;
      });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden) {
      _pausePlayback();
    } else if (state == AppLifecycleState.resumed) {
      if (widget.isActive) {
        _resumePlayback();
      }
    }
  }

  @override
  void didUpdateWidget(covariant ShortPlayerWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isActive == widget.isActive) return;

    if (widget.isActive) {
      // Normally _videoController is null here (becoming active always
      // follows a teardown via _releasePlayer below) and this cold-inits.
      // The `else` branch is a defensive fallback only.
      if (_videoController == null) {
        _initPlayer();
      } else {
        _resumePlayback();
      }
    } else {
      _releasePlayer();
    }
  }

  void _releasePlayer() {
    _playerGeneration++;
    _firstFrameRevealTimer?.cancel();
    final controller = _videoController;
    _videoController = null;
    _audioPlayer?.stop();
    _audioPlayer?.dispose();
    _audioPlayer = null;
    controller?.dispose();
    _progressNotifier.value = 0.0;
    if (mounted) {
      setState(() {
        _isInitialized = false;
        _isFirstFrameRendered = false;
        _isPlaying = false;
      });
    }
  }

  void _minimize() {
    final controller = _videoController;
    if (controller == null || !_isInitialized) return;

    ref
        .read(videoMiniPlayerServiceProvider)
        .activateShort(
          controller: controller,
          soundtrack: _audioPlayer,
          short: widget.short,
        );

    _progressNotifier.value = 0.0;
    setState(() {
      _videoController = null;
      _audioPlayer = null;
      _isInitialized = false;
      _isFirstFrameRendered = false;
      _isPlaying = false;
    });

    widget.onMinimized?.call();
  }

  void _pausePlayback() {
    _videoController?.pause();
    _audioPlayer?.pause();
    if (mounted) {
      setState(() => _isPlaying = false);
    }
  }

  void _resumePlayback() {
    if (_isInitialized && _videoController != null) {
      _videoController?.play();
      _audioPlayer?.resume();
      if (mounted) {
        setState(() => _isPlaying = true);
      }
    }
  }

  /// Flips the poster-to-video crossfade on. Safe to call repeatedly and
  /// from either the frame listener or the fallback timer — whichever gets
  /// there first wins, the other becomes a no-op.
  void _revealVideoLayer(VideoPlayerController controller) {
    if (!mounted || _isFirstFrameRendered) return;
    if (!identical(_videoController, controller)) return;
    _firstFrameRevealTimer?.cancel();
    setState(() {
      _isFirstFrameRendered = true;
    });
    // Only now — with this short demonstrably playing — is it safe to
    // spend a second decoder preparing the next one.
    if (widget.isActive) widget.onFirstFrame?.call();
  }

  /// Polls the platform playhead directly so the poster comes off the
  /// instant pictures are genuinely moving.
  ///
  /// This exists because of a detail of video_player that quietly cost half
  /// a second on every short: `VideoPlayerController` only refreshes
  /// `value.position` on its OWN 500ms periodic timer. Every reveal signal
  /// built on the controller's listener therefore fires up to 500ms after
  /// the video actually started playing — so the poster sat on top of an
  /// already-playing video for that whole time, which is indistinguishable
  /// from "stuck, hasn't started yet".
  ///
  /// `controller.position` is not that cached value; it is a live query to
  /// the platform. Asking it every 40ms gets the real answer roughly ten
  /// times sooner. Bounded at 1.5s, after which the existing backstop timer
  /// takes over.
  Future<void> _startFastRevealPoll(VideoPlayerController controller) async {
    final generation = _playerGeneration;
    final deadline = DateTime.now().add(const Duration(milliseconds: 1500));
    while (mounted &&
        !_isFirstFrameRendered &&
        generation == _playerGeneration &&
        identical(_videoController, controller) &&
        DateTime.now().isBefore(deadline)) {
      try {
        final position = await controller.position;
        if (position != null &&
            position > const Duration(milliseconds: 250) &&
            controller.value.size.width > 0) {
          _revealVideoLayer(controller);
          return;
        }
      } catch (_) {
        return;
      }
      await Future<void>.delayed(const Duration(milliseconds: 40));
    }
  }

  void _attachListenerAndReveal(VideoPlayerController controller) {
    controller.addListener(() {
      if (!mounted || !identical(_videoController, controller)) return;
      if (!_isFirstFrameRendered && shouldRevealShortFrame(controller.value)) {
        _revealVideoLayer(controller);
      }
      final duration = controller.value.duration;
      final position = controller.value.position;
      if (duration.inMilliseconds > 0) {
        final p = position.inMilliseconds / duration.inMilliseconds;
        if ((p - _progressNotifier.value).abs() > 0.005) {
          _progressNotifier.value = p.clamp(0.0, 1.0);
        }
      }
    });
  }

  /// Attaches this short's looping soundtrack, if it has one, without
  /// holding playback back while the audio loads.
  void _setupSoundtrack(VideoPlayerController controller, int generation) {
    final soundtrack = widget.short.soundtrack;
    if (soundtrack == null || soundtrack.url.isEmpty) {
      controller.setVolume(ShortsMuteState.instance.isMuted ? 0.0 : 1.0);
      return;
    }
    final audio = AudioPlayer();
    _audioPlayer = audio;
    controller.setVolume(0.0);
    audio.setVolume(ShortsMuteState.instance.isMuted ? 0.0 : 1.0);
    unawaited(() async {
      try {
        await audio.setReleaseMode(ReleaseMode.loop);
        await audio.setSourceUrl(soundtrack.url);
        if (!mounted ||
            generation != _playerGeneration ||
            !identical(_audioPlayer, audio)) {
          return;
        }
        await audio.resume();
      } catch (_) {}
    }());
  }

  Future<void> _initPlayer() async {
    final generation = ++_playerGeneration;
    try {
      // Did the feed already warm this exact short while the previous one
      // was playing? Then there is no decoder to allocate and no manifest
      // to fetch standing between the swipe and the picture.
      final warmed = ShortWarmCache.instance.take(widget.short.videoId);
      if (warmed != null) {
        if (!mounted || !widget.isActive || generation != _playerGeneration) {
          await warmed.dispose();
          return;
        }
        _videoController = warmed;
        _setupSoundtrack(warmed, generation);
        _attachListenerAndReveal(warmed);
        unawaited(warmed.play());
        unawaited(_startFastRevealPoll(warmed));
        if (mounted) {
          setState(() {
            _isInitialized = true;
            _isPlaying = true;
          });
        }
        return;
      }

      String? videoUrl = shortStreamUrl(widget.short);
      if (videoUrl == null && widget.short.videoId.isNotEmpty) {
        final videoService = ref.read(videoServiceProvider);
        final video = await videoService.getVideoById(widget.short.videoId);
        if (video != null &&
            video.muxPlaybackId != null &&
            video.muxPlaybackId!.isNotEmpty) {
          videoUrl =
              'https://stream.mux.com/${video.muxPlaybackId}.m3u8?max_resolution=720p';
        }
      }

      if (videoUrl == null ||
          !mounted ||
          !widget.isActive ||
          generation != _playerGeneration) {
        return;
      }

      final controller = VideoPlayerController.networkUrl(
        Uri.parse(videoUrl),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );
      _videoController = controller;

      // Start the video opening IMMEDIATELY, and let any soundtrack set
      // itself up alongside it instead of in front of it.
      //
      // This used to `await` the soundtrack's setSourceUrl before it even
      // touched the video, which put a whole extra network round-trip in
      // front of time-to-first-picture for every short that has a
      // soundtrack — dead time where the poster sits alone on screen.
      // Nothing about loading the audio is needed in order to decode
      // video, so there is no reason for one to wait on the other.
      final videoReady = controller.initialize();

      Future<void>? audioReady;
      final soundtrack = widget.short.soundtrack;
      if (soundtrack != null && soundtrack.url.isNotEmpty) {
        final audio = AudioPlayer();
        _audioPlayer = audio;
        controller.setVolume(0.0);
        audio.setVolume(ShortsMuteState.instance.isMuted ? 0.0 : 1.0);
        audioReady = () async {
          await audio.setReleaseMode(ReleaseMode.loop);
          await audio.setSourceUrl(soundtrack.url);
        }();
        // Swallow failures here so a bad soundtrack URL can never surface
        // as an unhandled async error; the await below re-throws into the
        // guarded block instead.
        audioReady.catchError((_) {});
      } else {
        controller.setVolume(ShortsMuteState.instance.isMuted ? 0.0 : 1.0);
      }

      await videoReady;
      if (!mounted || !widget.isActive || generation != _playerGeneration) {
        await controller.dispose();
        if (identical(_videoController, controller)) _videoController = null;
        return;
      }
      controller.setLooping(true);

      // NOTE: there used to be a `seekTo(1ms)` "pre-warm" here, plus a
      // 100ms wall-clock wait, meant to force one decoded frame onto the
      // texture before play(). Both are gone on purpose.
      //
      // Seeking an HLS stream that has only just finished initialize()
      // makes ExoPlayer jump to a sync sample and hand MediaCodec an
      // output buffer that has not been fully decoded yet. Rendering that
      // buffer is exactly what produced the green/blocky diagonal
      // garbage — uninitialized chroma planes read as green — and it
      // varied by handset because every SoC's decoder recovers from a
      // seek-before-first-keyframe differently. The pre-warm also made
      // playback re-buffer from the network right at open, which is what
      // left shorts sitting frozen on their poster.
      //
      // Letting the stream simply play from its natural start is both
      // faster to first picture and the only version that decodes a clean
      // frame on every device. The black-flash worry it was originally
      // added for is handled properly now by mounting the video texture
      // immediately (see build) and crossfading it in, rather than
      // mounting it late.

      _attachListenerAndReveal(controller);

      if (widget.isActive) {
        unawaited(controller.play());
        unawaited(_startFastRevealPoll(controller));
        // The soundtrack may still be loading — start it the moment it is
        // ready rather than holding the video back waiting for it.
        final audio = _audioPlayer;
        if (audio != null) {
          unawaited(() async {
            try {
              await audioReady;
              if (!mounted ||
                  generation != _playerGeneration ||
                  !identical(_audioPlayer, audio)) {
                return;
              }
              await audio.resume();
            } catch (_) {}
          }());
        }
      }

      if (mounted) {
        setState(() {
          _isInitialized = true;
          _isPlaying = widget.isActive;
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    ShortsMuteState.instance.muted.removeListener(_onMuteChanged);
    _holdTimer?.cancel();
    _firstFrameRevealTimer?.cancel();
    _videoController?.pause();
    _videoController?.dispose();
    _videoController = null;
    _audioPlayer?.stop();
    _audioPlayer?.dispose();
    _audioPlayer = null;
    _progressNotifier.dispose();
    super.dispose();
  }

  void _togglePlay() {
    // Swallow the tap that ended a fast-forward hold.
    if (_suppressNextTap) {
      _suppressNextTap = false;
      return;
    }
    if (_videoController == null || !_isInitialized) return;
    if (_videoController!.value.isPlaying) {
      _pausePlayback();
    } else {
      _resumePlayback();
    }
  }

  Future<void> _toggleLike() async {
    if (widget.short.videoId.isEmpty) return;
    final wasLiked = _isLiked;
    setState(() {
      _isLiked = !wasLiked;
      _likeCount += wasLiked ? -1 : 1;
      if (!_isLiked) {
        _showHeartBurst = false;
      } else {
        _showHeartBurst = true;
      }
    });

    if (_showHeartBurst) {
      // 800ms, matching the site's `setTimeout(() => setBurstIndex(null), 800)`.
      Future.delayed(const Duration(milliseconds: 800), () {
        if (mounted) setState(() => _showHeartBurst = false);
      });
    }

    final likeService = ref.read(likeServiceProvider);
    final ok = await likeService.react(
      widget.short.videoId,
      wasLiked ? 'remove' : 'like',
    );
    if (!ok && mounted) {
      setState(() {
        _isLiked = wasLiked;
        _likeCount += wasLiked ? 1 : -1;
      });
    }
  }

  Future<void> _toggleWatchlist() async {
    if (widget.short.videoId.isEmpty) return;
    final wasSaved = _isSaved;
    setState(() => _isSaved = !wasSaved);

    final service = ref.read(watchlistServiceProvider);
    final ok = wasSaved
        ? await service.remove(widget.short.videoId)
        : await service.add(widget.short.videoId);

    if (!ok && mounted) {
      setState(() => _isSaved = wasSaved);
    }
  }

  Future<void> _toggleSubscribe() async {
    final creatorId = widget.short.uploaderId;
    if (creatorId == null || creatorId.isEmpty) return;

    final wasSubscribed = _isSubscribed;
    setState(() => _isSubscribed = !wasSubscribed);

    final service = ref.read(channelServiceProvider);
    final ok = wasSubscribed
        ? await service.unsubscribeFromChannel(creatorId)
        : await service.subscribeToChannel(creatorId);

    if (!ok && mounted) {
      setState(() => _isSubscribed = wasSubscribed);
    }
  }

  void _shareShort() {
    // /shorts/{id} (not /watch/{id}) so the link lands on the scrolling
    // Shorts feed at this video instead of the raw watch page.
    final url = 'https://inplayer.in/shorts/${widget.short.videoId}';
    SharePlus.instance.share(
      ShareParams(
        text: '${widget.short.title}\n$url',
        subject: widget.short.title,
      ),
    );
  }

  void _showCommentsModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ShortCommentsSheet(
        videoId: widget.short.videoId,
        onCommentAdded: () {
          setState(() => _commentCount++);
        },
      ),
    );
  }

  List<InlineSpan> _buildCaptionSpans(String text) {
    final spans = <InlineSpan>[];
    final parts = text.split(RegExp(r'(\s+)'));
    for (final part in parts) {
      if (part.startsWith('#') && part.length > 1) {
        spans.add(
          TextSpan(
            text: '$part ',
            style: const TextStyle(
              color: Color(0xFF7DD3FC), // sky-300 matching web
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
          ),
        );
      } else {
        spans.add(
          TextSpan(
            text: '$part ',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        );
      }
    }
    return spans;
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // 1. Video or Poster Layer with Tap to Toggle / Double Tap to Like
        GestureDetector(
          onTap: _togglePlay,
          onTapDown: _startHold,
          onTapUp: (_) => _endHold(),
          onTapCancel: _endHold,
          onDoubleTap: () {
            if (!_isLiked) _toggleLike();
          },
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Video surface FIRST, poster on top of it — the order is the
              // whole fix, and it has now been wrong in both directions.
              //
              // Attempt one mounted this at opacity 0 and crossfaded in on
              // the first frame. That failed because RenderOpacity SKIPS
              // PAINTING ITS CHILD ENTIRELY at alpha 0
              // (`if (_alpha == 0) return;`), so the texture's first real
              // composite was deferred until the fade began — landing on
              // precisely the moment the fade existed to make seamless.
              //
              // Attempt two dropped the opacity layer and put the poster
              // permanently underneath, on the theory that a Texture with
              // nothing decoded in it "simply paints nothing". It does not.
              // A TextureLayer composites whatever its SurfaceTexture
              // currently holds, and before the first frame arrives that is
              // undefined — in practice black. So the moment `_isInitialized`
              // flipped, an opaque black rectangle was laid over the poster
              // for the frame or three before real picture arrived. That is
              // the single flash still being reported.
              //
              // The fix is neither: mount the texture as early as possible
              // so it attaches and decodes, and keep the POSTER ABOVE IT
              // until the decoder has demonstrably produced moving picture
              // (see shouldRevealShortFrame — real frame dimensions plus a
              // playhead that has actually advanced). The poster is only
              // withdrawn once there is something real behind it, so there
              // is never a frame where an empty texture is what's on screen.
              if (_isInitialized && _videoController != null)
                Positioned.fill(
                  child: FittedBox(
                    fit: BoxFit.cover,
                    clipBehavior: Clip.hardEdge,
                    child: SizedBox(
                      width: _videoController!.value.size.width > 0
                          ? _videoController!.value.size.width
                          : 720,
                      height: _videoController!.value.size.height > 0
                          ? _videoController!.value.size.height
                          : 1280,
                      child: VideoPlayer(_videoController!),
                    ),
                  ),
                ),

              // Held above the texture, withdrawn (not faded — a fade is
              // another offscreen saveLayer over a video texture) the
              // instant real frames are flowing.
              if (!_isFirstFrameRendered)
                Positioned.fill(child: _buildShortPoster()),
            ],
          ),
        ),

        // 2. Heart Burst on Double-Tap
        //
        // Every overlay from here down is wrapped in IgnorePointer, matching
        // the `pointer-events-none` the website puts on the same layers.
        // In Flutter a decorated Container is hit-testable, so any of these
        // sitting above the tap GestureDetector silently ate the tap.
        if (_showHeartBurst)
          IgnorePointer(
            child: Center(
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.0, end: 1.2),
              duration: const Duration(milliseconds: 400),
              builder: (context, val, child) {
                return Transform.scale(
                  scale: val,
                  child: const Icon(
                    Icons.favorite,
                    size: 110,
                    color: Color(0xFFF43F5E), // rose-500
                    shadows: [Shadow(color: Colors.black54, blurRadius: 20)],
                  ),
                );
              },
            ),
          ),
        ),

        // 3. Play/Pause central indicator when explicitly paused.
        //
        // This one was the cruellest: as a bare Container it absorbed taps
        // itself, so once a short was paused the play badge sat exactly
        // where you would tap to resume and blocked it. Purely decorative
        // now — the tap goes through to the video layer underneath.
        if (!_isPlaying && _isInitialized && _isFirstFrameRendered)
          IgnorePointer(
            child: Center(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white24, width: 1.5),
                ),
                child: const Icon(
                  Icons.play_arrow,
                  size: 48,
                  color: Colors.white,
                ),
              ),
            ),
          ),

        // 4. Subtle Vignette / Gradient overlays
        // Stays pinned to the true bottom (no bottomInset) so the scrim
        // still runs behind the translucent nav bar rather than stopping
        // short of it and leaving a hard edge — but it grows by the same
        // amount so the fade still starts above the raised content.
        // THE tap thief: this scrim covers the bottom 360dp of the screen —
        // most of where a thumb naturally lands — and as a decorated
        // Container it swallowed every tap in that area. The site marks the
        // identical gradient `pointer-events-none`.
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          height: 360 + widget.bottomInset,
          child: IgnorePointer(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.90),
                    Colors.black.withValues(alpha: 0.50),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),
        ),

        // 5. Right Action Sidebar (Like, Comment, Share, Save, Watch Full)
        Positioned(
          bottom: 28 + widget.bottomInset,
          right: 14,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              // Like Action
              _buildActionButton(
                icon: _isLiked ? Icons.favorite : Icons.favorite_border,
                label: _likeCount > 0 ? '$_likeCount' : 'Like',
                iconColor: _isLiked ? const Color(0xFFF43F5E) : Colors.white,
                onTap: _toggleLike,
              ),
              const SizedBox(height: 18),

              // Comment Action
              _buildActionButton(
                icon: Icons.chat_bubble_outline,
                label: _commentCount > 0 ? '$_commentCount' : 'Comment',
                onTap: _showCommentsModal,
              ),
              const SizedBox(height: 18),

              // Share Action
              _buildActionButton(
                icon: Icons.share_outlined,
                label: 'Share',
                onTap: _shareShort,
              ),
              const SizedBox(height: 18),

              // Bookmark / Save Action
              _buildActionButton(
                icon: _isSaved ? Icons.bookmark : Icons.bookmark_border,
                label: _isSaved ? 'Saved' : 'Save',
                iconColor: _isSaved ? AppColors.brandGold : Colors.white,
                onTap: _toggleWatchlist,
              ),
              const SizedBox(height: 18),

              // Watch full video / page button
              GestureDetector(
                onTap: () {
                  if (widget.short.videoId.isNotEmpty) {
                    context.push('/watch/${widget.short.videoId}');
                  }
                },
                child: Column(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.45),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white24, width: 1),
                      ),
                      child: const Icon(
                        Icons.fullscreen,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Full page',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // 6. Bottom-Left Creator & Caption Information
        Positioned(
          bottom: 24 + widget.bottomInset,
          left: 16,
          right: 84,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Creator Row + Subscribe Button
              Row(
                children: [
                  UserAvatar(
                    avatarUrl: widget.short.uploaderAvatarUrl,
                    name: widget.short.creator,
                    size: 36,
                    onTap: () {
                      if (widget.short.uploaderUsername != null) {
                        context.push(
                          '/channel/${widget.short.uploaderUsername}',
                        );
                      }
                    },
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        if (widget.short.uploaderUsername != null) {
                          context.push(
                            '/channel/${widget.short.uploaderUsername}',
                          );
                        }
                      },
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  widget.short.creator,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(
                                Icons.verified,
                                size: 14,
                                color: AppColors.brandGold,
                              ),
                            ],
                          ),
                          if (widget.short.uploaderUsername != null)
                            Text(
                              '@${widget.short.uploaderUsername}',
                              style: const TextStyle(
                                color: AppColors.brandGold,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Subscribe Button
                  if (widget.short.uploaderId != null &&
                      widget.short.uploaderId!.isNotEmpty)
                    GestureDetector(
                      onTap: _toggleSubscribe,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          gradient: _isSubscribed
                              ? null
                              : AppColors.flameGradient,
                          color: _isSubscribed
                              ? Colors.white.withValues(alpha: 0.15)
                              : null,
                          borderRadius: BorderRadius.circular(20),
                          border: _isSubscribed
                              ? Border.all(color: Colors.white24)
                              : null,
                        ),
                        child: Text(
                          // The container's own gradient/border already
                          // carries the subscribed-vs-not state (website's
                          // ShortsPlayer.tsx keeps the same "In-Family"
                          // label either way) — was previously "Subscribed"
                          // even though every other subscribe control in
                          // this app calls it "In-Family".
                          'In-Family',
                          style: TextStyle(
                            color: _isSubscribed ? Colors.white : Colors.black,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 10),

              // Title / Caption with hashtag highlights
              RichText(
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                text: TextSpan(
                  children: _buildCaptionSpans(widget.short.title),
                ),
              ),

              const SizedBox(height: 8),

              // Soundtrack / Views Meta Pill
              Row(
                children: [
                  if (widget.short.soundtrack != null) ...[
                    const Icon(
                      Icons.music_note,
                      size: 14,
                      color: AppColors.brandGold,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        widget.short.soundtrack?.title ?? 'Soundtrack',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Text(
                    widget.short.views,
                    style: const TextStyle(color: Colors.white60, fontSize: 11),
                  ),
                ],
              ),
            ],
          ),
        ),

        // 7. Top Linear Progress Bar
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: IgnorePointer(
            child: ValueListenableBuilder<double>(
              valueListenable: _progressNotifier,
              builder: (context, progress, child) {
                return LinearProgressIndicator(
                  value: progress,
                  minHeight: 2.5,
                  backgroundColor: Colors.white24,
                  valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                );
              },
            ),
          ),
        ),

        // 7b. "2x Speed" badge while holding — top-centre black pill,
        // mirroring the site's badge (`left-1/2 top-6`, bg-black/60).
        if (_speedBoost)
          IgnorePointer(
            child: Align(
              alignment: Alignment.topCenter,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '2\u00D7',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            height: 1,
                          ),
                        ),
                        SizedBox(width: 6),
                        Text(
                          'SPEED',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

        // 8a. Mute / unmute. Top-right, mirroring the website's header
        // control (`toggleMuted`, VolumeX / Volume2). The site keeps this
        // as ONE feed-level choice rather than per short, so it is backed
        // by ShortsMuteState and every card reflects the same value.
        Positioned(
          top: 0,
          right: widget.onMinimized != null ? 56 : 0,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.only(right: 10, top: 8),
              child: GestureDetector(
                onTap: () => ShortsMuteState.instance.toggle(),
                behavior: HitTestBehavior.opaque,
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.42),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    ShortsMuteState.instance.isMuted
                        ? Icons.volume_off_rounded
                        : Icons.volume_up_rounded,
                    color: Colors.white,
                    size: 19,
                  ),
                ),
              ),
            ),
          ),
        ),

        // 8. Minimize into the floating corner window. Top-right, mirroring
        // the feed's back button top-left (which lives in shorts_page.dart
        // because it must not move with the swipe transform — this one is
        // per-card on purpose, since it acts on *this* card's controller).
        if (widget.onMinimized != null)
          Positioned(
            top: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.only(right: 10, top: 8),
                child: GestureDetector(
                  onTap: _minimize,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.42),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.picture_in_picture_alt_rounded,
                      color: Colors.white,
                      size: 19,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    Color iconColor = Colors.white,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.45),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white12, width: 1),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShortPoster() {
    // Every "no picture yet" surface below is pure black, deliberately.
    //
    // AppColors.surfaceDark is #0A0D18 — a dark navy, not black — while
    // the shorts Scaffold behind this is Colors.black. Painting the
    // placeholder navy therefore drew a visibly lighter rectangle over a
    // black screen for as long as the thumbnail took to arrive, and then
    // snapped to the real image. Black-on-black makes that same waiting
    // period invisible instead of a flash.
    if (_posterUrl.isEmpty) {
      return const ColoredBox(color: Colors.black);
    }

    if (isDataImageUrl(_posterUrl)) {
      final bytes = decodeDataImageUrl(_posterUrl);
      if (bytes != null) {
        return Image.memory(
          bytes,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) =>
              const ColoredBox(color: Colors.black),
        );
      }
    }

    return CachedNetworkImage(
      imageUrl: _posterUrl,
      fit: BoxFit.cover,
      useOldImageOnUrlChange: true,
      fadeInDuration: Duration.zero,
      fadeOutDuration: Duration.zero,
      placeholder: (context, url) => const ColoredBox(
        color: Colors.black,
      ),
      errorWidget: (context, url, error) => Container(
        color: Colors.black,
        child: const Center(
          child: Icon(
            Icons.play_arrow_rounded,
            color: AppColors.brandOrange,
            size: 48,
          ),
        ),
      ),
    );
  }
}

/// Frosted Glass Comments Sheet for Shorts
class _ShortCommentsSheet extends ConsumerStatefulWidget {
  final String videoId;
  final VoidCallback onCommentAdded;

  const _ShortCommentsSheet({
    required this.videoId,
    required this.onCommentAdded,
  });

  @override
  ConsumerState<_ShortCommentsSheet> createState() =>
      _ShortCommentsSheetState();
}

class _ShortCommentsSheetState extends ConsumerState<_ShortCommentsSheet> {
  final TextEditingController _commentCtrl = TextEditingController();
  List<Comment> _comments = [];
  bool _loading = true;
  bool _posting = false;

  @override
  void initState() {
    super.initState();
    _fetchComments();
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchComments() async {
    try {
      final service = ref.read(commentServiceProvider);
      final list = await service.getComments(widget.videoId);
      if (mounted) {
        setState(() {
          _comments = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _postComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty || _posting) return;

    setState(() => _posting = true);
    final service = ref.read(commentServiceProvider);
    final res = await service.postComment(widget.videoId, text);

    if (mounted) {
      setState(() => _posting = false);
      if (res.comment != null) {
        _commentCtrl.clear();
        setState(() {
          _comments.insert(0, res.comment!);
        });
        widget.onCommentAdded();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.65,
      decoration: BoxDecoration(
        color: AppColors.drawerDark.withValues(alpha: 0.95),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        children: [
          // Drag Handle & Header
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 8),
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${_comments.length} Comments',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                IconButton(
                  icon: const Icon(
                    Icons.close,
                    color: Colors.white70,
                    size: 20,
                  ),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(color: Colors.white12, height: 1),

          // Comments List
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                      color: AppColors.brandOrange,
                    ),
                  )
                : _comments.isEmpty
                ? const Center(
                    child: Text(
                      'No comments yet. Be the first to comment!',
                      style: TextStyle(color: Colors.white54),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    itemCount: _comments.length,
                    itemBuilder: (ctx, i) {
                      final c = _comments[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 14,
                              backgroundColor: Colors.white12,
                              backgroundImage: c.userAvatarUrl != null
                                  ? smartImageProvider(c.userAvatarUrl!)
                                  : null,
                              child: c.userAvatarUrl == null
                                  ? const Icon(
                                      Icons.person,
                                      size: 16,
                                      color: Colors.white70,
                                    )
                                  : null,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        c.userName,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        c.timeAgo,
                                        style: const TextStyle(
                                          color: Colors.white38,
                                          fontSize: 10,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    c.text,
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),

          // Input Bar
          Container(
            padding: EdgeInsets.fromLTRB(
              16,
              8,
              16,
              MediaQuery.of(context).viewInsets.bottom + 12,
            ),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.4),
              border: const Border(top: BorderSide(color: Colors.white10)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentCtrl,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _postComment(),
                    decoration: InputDecoration(
                      hintText: 'Add a comment...',
                      hintStyle: const TextStyle(color: Colors.white38),
                      filled: true,
                      fillColor: Colors.white.withValues(alpha: 0.08),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(20),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Small circular "enter" arrow button, replacing the old
                // bare paper-plane icon — same _postComment call, which
                // already no-ops on empty text/while posting, so tap
                // behavior is unchanged either way.
                GestureDetector(
                  onTap: _postComment,
                  child: Container(
                    width: 34,
                    height: 34,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.brandOrange,
                    ),
                    alignment: Alignment.center,
                    child: _posting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation(Colors.white),
                            ),
                          )
                        : const Icon(
                            Icons.arrow_upward_rounded,
                            color: Colors.white,
                            size: 18,
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
