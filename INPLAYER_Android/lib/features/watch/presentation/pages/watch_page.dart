import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logger/logger.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/video_service.dart';
import '../../../../services/like_service.dart';
import '../../../../services/watchlist_service.dart';
import '../../../../services/comment_service.dart';
import '../../../../services/channel_service.dart';
import '../../../../models/video.dart';
import '../../../../models/comment.dart';
import '../../../../services/premium_service.dart';
import '../../../../services/history_service.dart';
import '../../../../services/caption_service.dart';
import '../../../../services/download_service.dart';
import '../../../../services/download_manager.dart';
import '../../../../services/pip_service.dart';
import '../../../../core/widgets/pattern_background.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../core/utils/playback_position_store.dart';
import '../../../../core/utils/playback_settings_store.dart';
import '../../../../core/utils/webvtt_parser.dart';
import '../../../../services/video_mini_player_service.dart';
import '../widgets/music_stage.dart';
import '../widgets/player_chrome.dart';
import '../widgets/video_options_sheet.dart';
import 'fullscreen_player_page.dart';

class WatchPage extends ConsumerStatefulWidget {
  final String videoId;

  // Set when this page is opened by re-expanding the draggable mini player
  // (see VideoMiniPlayerOverlay._restore, and app_router.dart's '/watch'
  // route reading it back out of `state.extra`). When present, _loadVideo()
  // adopts this already-initialized, already-playing controller instead of
  // creating a new one, so re-expanding never restarts or re-buffers.
  final VideoPlayerController? adoptController;

  const WatchPage({super.key, required this.videoId, this.adoptController});

  @override
  ConsumerState<WatchPage> createState() => _WatchPageState();
}

class _WatchPageState extends ConsumerState<WatchPage>
    with WidgetsBindingObserver {
  final _logger = Logger();
  final _commentController = TextEditingController();

  // True rotate-the-phone-to-fullscreen (the website's *other* fullscreen
  // trigger besides its manual button — see VideoPlayer.tsx's
  // device-rotation effect). The "rotate TO landscape -> enter fullscreen"
  // half is handled right here via WidgetsBinding's didChangeMetrics + the
  // current screen size, which reflects physical rotation as long as
  // nothing has locked the app's orientation yet (true on this plain watch
  // page). The reverse — "rotate back to portrait -> auto-exit" — can't use
  // the same signal: once FullscreenPlayerPage locks the app to landscape,
  // Flutter's own metrics/MediaQuery size stops following the physical
  // sensor. That half now lives in FullscreenPlayerPage itself, via a raw
  // device-orientation-sensor stream (native_device_orientation) that reads
  // the sensor directly rather than through Flutter's locked rendering.
  bool _inFullscreen = false;

  // Picture-in-Picture (Android system PiP, via pip_service.dart's platform
  // channel to MainActivity.kt). `_pipSupported` gates whether the manual
  // PiP button even shows (PlayerChrome hides it entirely when false, same
  // pattern as the CC button and empty caption languages). `_inPip` mirrors
  // whether the OS has actually floated this Activity into its small PiP
  // window right now — while true, build() below renders nothing but the
  // bare video frame, since there's no room (or touch access) for the
  // normal chrome/info panel in that tiny window. `_autoPipEnabled` caches
  // the viewer's Settings > Playback > "Picture in Picture" preference,
  // read once when the video loads, so onUserLeaveHint() on the native side
  // only auto-triggers PiP when they've actually opted in — the manual
  // button bypasses this and always works regardless.
  bool _pipSupported = false;
  bool _inPip = false;
  bool _autoPipEnabled = false;
  bool _lastPlayingForPip = false;

  VideoPlayerController? _videoController;
  bool _isInitialized = false;
  bool _isLoading = true;
  Video? _video;
  bool _descExpanded = false;
  List<Video> _recommendedVideos = [];

  // Player chrome: quality (Mux `max_resolution`, capped by the viewer's
  // real Premium tier), and throttled "remember playback position" saves —
  // mirrors VideoPlayer.tsx's `maxResolution`/`savePlaybackPosition`.
  String _qualityLabel = 'Auto';
  int _premiumCeilingHeight = 1080;
  int _lastPositionSaveMs = 0;
  bool _resumeApplied = false;

  // Matches QUALITY_OPTIONS in app/lib/premium.ts exactly — Auto plus the
  // four real Mux maxResolution values. (No 480p/360p: those are valid Mux
  // MIN renditions but not valid MAX/ceiling ones — an earlier version of
  // this list offered them and would have silently left playback uncapped
  // if ever picked; also previously missing 1440p/2K entirely.)
  static const List<QualityOption> _allQualityOptions = [
    QualityOption('Auto', null),
    QualityOption('720p (HD)', 720),
    QualityOption('1080p (Full HD)', 1080),
    QualityOption('1440p (2K)', 1440),
    QualityOption('2160p (4K Ultra HD)', 2160),
  ];

  List<QualityOption> get _availableQualityOptions => _allQualityOptions
      .where((o) => o.heightPx == null || o.heightPx! <= _premiumCeilingHeight)
      .toList();

  // Captions — fetched once the video is known; empty language list hides
  // the CC button entirely (see PlayerChrome). `_selectedCaptionLang` null
  // means Off.
  List<CaptionLanguage> _captionLanguages = [];
  String? _selectedCaptionLang;
  List<CaptionCue> _captionCues = [];

  // Likes
  int _likeCount = 0;
  int _dislikeCount = 0;
  String? _myReaction;
  bool _likeBusy = false;

  // Watchlist ("Save")
  bool _isSaved = false;
  bool _watchlistBusy = false;

  // Download — see download_manager.dart for the actual transfer; this
  // page only owns the "prepare the file server-side, then let the viewer
  // pick a quality" step in front of it.
  bool _downloadPreparing = false;

  // Subscribe (uploader row)
  bool _isSubscribed = false;
  int? _subscriberCount;
  bool _subscribeBusy = false;

  // Comments
  List<Comment> _comments = [];
  bool _commentsLoading = false;
  bool _commentsExpanded = false;
  bool _postingComment = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    PipService.setPipModeChangedListener(_handlePipModeChanged);
    unawaited(() async {
      final supported = await PipService.isSupported();
      if (mounted) setState(() => _pipSupported = supported);
    }());
    _loadVideo();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    // Belt-and-braces — a stale "playback active" flag left on the native
    // side after this page closes could otherwise cause a phantom auto-PiP
    // trigger the next time the user backgrounds the app from somewhere
    // else entirely.
    unawaited(PipService.setPlaybackActive(false));
    _videoController?.removeListener(_onPlayerTick);
    _videoController?.dispose();
    _commentController.dispose();
    super.dispose();
  }

  // The OS actually entering/exiting PiP (not just a request being made —
  // enterPip()/the OS can still decline). If a landscape FullscreenPlayerPage
  // route was showing when this fires, pop it first: that page's landscape
  // lock + immersive system UI don't make sense squeezed into a tiny
  // floating window, and this page's own minimal PiP layout (see build())
  // is what should show while floating, regardless of which screen PiP was
  // triggered from.
  void _handlePipModeChanged(bool isInPip) {
    if (!mounted) return;
    setState(() => _inPip = isInPip);
    if (isInPip && _inFullscreen) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _enterPip() async {
    if (!_pipSupported) return;
    final controller = _videoController;
    final size = controller?.value.size ?? const Size(16, 9);
    final width = size.width > 0 ? size.width.round() : 16;
    final height = size.height > 0 ? size.height.round() : 9;
    await PipService.enter(width: width, height: height);
  }

  @override
  void didChangeMetrics() {
    super.didChangeMetrics();
    _maybeAutoFullscreenOnRotate();
  }

  // Fires on every window-metrics change, including a physical device
  // rotation. Guarded so it only ever acts once per rotation-into-landscape
  // (via _inFullscreen) and only when there's actually a video loaded to
  // show fullscreen.
  void _maybeAutoFullscreenOnRotate() {
    if (!mounted || _inFullscreen || _videoController == null) return;
    final view = View.of(context);
    final size = view.physicalSize / view.devicePixelRatio;
    if (size.width > size.height) {
      _openFullscreen();
    }
  }

  void _onPlayerTick() {
    // MusicStage (the lyrics/cover-art surface _buildMediaSurface() renders
    // for music-content videos) reads controller.value.position as a plain
    // constructor param, so it only gets fresh numbers when THIS page
    // itself rebuilds — setState() is genuinely needed for that case. For
    // a regular video, nothing here needs it: the video frame is painted
    // by VideoPlayer(controller) itself, and PlayerChrome (the
    // scrubber/timestamps/buffering/controls overlay) already has its own
    // listener on this same controller — neither depends on this page
    // rebuilding to refresh. Unconditionally rebuilding the ENTIRE watch
    // page — title, action bar, description, full comments list, ad
    // banner, recommended videos — many times a second for a plain video
    // was pure overhead competing with real video decode/render for
    // main-thread time: a concrete, measurable source of stutter and
    // sluggish-feeling taps, not just wasted work.
    if (mounted && (_video?.isMusic ?? false)) {
      setState(() {});
    }
    _maybeSavePlaybackPosition();
    _maybeUpdatePipPlaybackState();
  }

  // Only calls into the platform channel when play/pause actually changes
  // (this listener otherwise fires many times a second) — and only reports
  // "active" to the native side when the viewer has actually opted in to
  // auto-PiP in Settings, so onUserLeaveHint() there never fires for anyone
  // who hasn't turned the preference on.
  void _maybeUpdatePipPlaybackState() {
    final playing = _videoController?.value.isPlaying ?? false;
    if (playing == _lastPlayingForPip) return;
    _lastPlayingForPip = playing;
    unawaited(
      PipService.setPlaybackActive(playing && _autoPipEnabled && _pipSupported),
    );
  }

  // Throttled to once every ~4s (this listener fires many times a second) —
  // matches VideoPlayer.tsx's own `lastPositionSaveRef` throttle, and for
  // the same reason: a write on every tick would be a needless hot-path
  // write for a value nobody reads until the next time this video opens.
  void _maybeSavePlaybackPosition() {
    final controller = _videoController;
    final video = _video;
    if (controller == null || video == null || !controller.value.isInitialized)
      return;

    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - _lastPositionSaveMs < 4000) return;
    _lastPositionSaveMs = now;

    final position = controller.value.position;
    final duration = controller.value.duration;
    // The "already finished, don't save" guard now lives inside
    // PlaybackPositionStore.save() itself (matching the real
    // END_THRESHOLD_SECONDS=20 from app/lib/playbackPositions.ts). The
    // "Remember playback position" Settings toggle is checked here so
    // turning it off actually stops new writes, not just future resumes.
    unawaited(() async {
      final settings = await PlaybackSettingsStore.get();
      if (!settings.rememberPosition) return;
      await PlaybackPositionStore.save(
        video.videoId,
        position.inMilliseconds / 1000.0,
        duration.inMilliseconds / 1000.0,
      );
    }());
  }

  Future<void> _applyResumePosition() async {
    if (_resumeApplied) return;
    _resumeApplied = true;
    final controller = _videoController;
    if (controller == null) return;

    // Also respects the "Remember playback position" Settings toggle — off
    // means resuming shouldn't happen even if a stale position is somehow
    // still stored (turning it off also clears everything via
    // PlaybackPositionStore.clearAll(), but this is a defense-in-depth
    // check against any position saved before that toggle existed).
    final settings = await PlaybackSettingsStore.get();
    if (!settings.rememberPosition) return;

    final saved = await PlaybackPositionStore.get(widget.videoId);
    if (saved == null || saved <= 0) return;
    final duration = controller.value.duration;
    if (duration > Duration.zero &&
        duration - Duration(milliseconds: (saved * 1000).round()) <
            const Duration(seconds: 20)) {
      await PlaybackPositionStore.clear(widget.videoId);
      return;
    }
    try {
      await controller.seekTo(Duration(milliseconds: (saved * 1000).round()));
    } catch (_) {
      // Starting from 0 is an acceptable fallback — never worth surfacing.
    }
  }

  String _muxUrl(String playbackId, String maxResolution) {
    return 'https://stream.mux.com/$playbackId.m3u8?max_resolution=$maxResolution';
  }

  // Real closed captions. The website's player shows these via Mux's own
  // embedded HLS text tracks (`defaultHiddenCaptions` in VideoPlayer.tsx) —
  // `video_player`'s ExoPlayer wrapper has no API to read those. Instead
  // this fetches the identical underlying WebVTT the backend already
  // exposes for exactly this (GET /api/videos/{id}/captions-list and
  // .../captions/{lang} — see app/lib/captions.ts / vttChunker.ts) and
  // renders it as a synced overlay in PlayerChrome.
  Future<void> _loadCaptions(String videoId) async {
    final languages = await ref
        .read(captionServiceProvider)
        .getLanguages(videoId);
    if (!mounted) return;
    setState(() => _captionLanguages = languages);
    if (languages.isEmpty) return;

    // Captions start OFF for every viewer by default unless Settings >
    // Playback > "Closed Captions" is on — matches
    // defaultHiddenCaptions={!playback.captions} in VideoPlayer.tsx. The CC
    // button still lets a viewer turn a language on manually either way.
    final playbackSettings = await PlaybackSettingsStore.get();
    if (!playbackSettings.captions || !mounted) return;

    final preferred = languages.firstWhere(
      (l) => l.code == 'en',
      orElse: () => languages.first,
    );
    await _selectCaptionLanguage(preferred.code);
  }

  Future<void> _selectCaptionLanguage(String? code) async {
    if (code == null) {
      if (mounted) {
        setState(() {
          _selectedCaptionLang = null;
          _captionCues = [];
        });
      }
      return;
    }

    final video = _video;
    if (video == null) return;
    final vtt = await ref
        .read(captionServiceProvider)
        .getVtt(video.videoId, code);
    if (!mounted) return;

    if (vtt == null) {
      setState(() {
        _selectedCaptionLang = null;
        _captionCues = [];
      });
      _showSnack("Couldn't load captions for that language.");
      return;
    }

    setState(() {
      _selectedCaptionLang = code;
      _captionCues = WebVttParser.parse(vtt);
    });
  }

  // Manual "Quality" menu: there is no per-rendition selection API exposed
  // by the `video_player`/ExoPlayer integration this app uses (unlike the
  // website's <mux-player>, which has one built in), so this reproduces
  // the same practical effect — constraining the HLS ceiling — the way the
  // Premium cap already does: rebuild the stream URL with a different
  // `max_resolution`, swap the controller, and resume at the exact same
  // position/play-state/speed/volume so switching is seamless rather than
  // a visible restart. Never allowed to exceed the viewer's real Premium
  // ceiling, same as the website's own maxResolution prop.
  Future<void> _switchQuality(String label) async {
    final video = _video;
    final oldController = _videoController;
    if (video?.muxPlaybackId == null || oldController == null) return;

    final chosen = _allQualityOptions.firstWhere(
      (o) => o.label == label,
      orElse: () => _allQualityOptions.first,
    );
    final effectiveHeight = chosen.heightPx == null
        ? _premiumCeilingHeight
        : math.min(chosen.heightPx!, _premiumCeilingHeight);
    final maxResolution = '${effectiveHeight}p';

    final wasPlaying = oldController.value.isPlaying;
    final position = oldController.value.position;
    final speed = oldController.value.playbackSpeed;
    final volume = oldController.value.volume;

    final newController = VideoPlayerController.networkUrl(
      Uri.parse(_muxUrl(video!.muxPlaybackId!, maxResolution)),
    );

    try {
      await newController.initialize();
      await newController.seekTo(position);
      await newController.setPlaybackSpeed(speed);
      await newController.setVolume(volume);
    } catch (e) {
      _logger.e('Error switching quality: $e');
      await newController.dispose();
      return;
    }

    if (!mounted) {
      await newController.dispose();
      return;
    }

    oldController.removeListener(_onPlayerTick);
    await oldController.dispose();

    newController.addListener(_onPlayerTick);
    setState(() {
      _videoController = newController;
      _qualityLabel = label;
    });
    if (wasPlaying) newController.play();
  }

  Future<void> _loadVideo() async {
    try {
      final videoService = ref.read(videoServiceProvider);
      final video = await videoService.getVideoById(widget.videoId);

      if (video == null) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      // Adopt an already-playing controller either explicitly (re-expanding
      // the mini player — see the class doc on `adoptController`) or
      // implicitly (this exact video happens to already be minimized and
      // the viewer landed on its watch page some other way, e.g. tapping it
      // again from a video grid) — either way, this must NOT create a
      // second, competing controller/player for the same video.
      final miniPlayerService = ref.read(videoMiniPlayerServiceProvider);
      final adoptedController =
          widget.adoptController ??
          (miniPlayerService.video?.videoId == widget.videoId
              ? miniPlayerService.detachForRestore()
              : null);

      if (adoptedController != null) {
        // This exact controller was already initialized and has been
        // playing uninterrupted this whole time — re-creating it or
        // reapplying the saved resume position here would restart/rewind a
        // video that's already mid-playback. Quality-ceiling/PiP setup
        // below still needs to happen (same as a fresh open), just not the
        // controller creation itself.
        final premiumService = ref.read(premiumServiceProvider);
        final playbackSettings = await PlaybackSettingsStore.get();
        final status = await premiumService.getStatus();
        final maxRes = effectiveMaxResolution(
          status.maxResolution,
          playbackSettings.wifiQuality,
        );
        _premiumCeilingHeight =
            int.tryParse(maxRes.replaceAll(RegExp(r'[^0-9]'), '')) ?? 1080;
        _autoPipEnabled = playbackSettings.pip;
        _videoController = adoptedController;
        _videoController!.addListener(_onPlayerTick);
        _isInitialized = true;
        _resumeApplied = true;
      } else if (video.muxPlaybackId != null &&
          video.muxPlaybackId!.isNotEmpty) {
        final premiumService = ref.read(premiumServiceProvider);
        final playbackSettings = await PlaybackSettingsStore.get();
        // The real ceiling is the LOWER of the viewer's Premium tier and
        // whatever they picked in Settings > Playback > Video quality —
        // matches maxResolution={effectiveMaxResolution(premium.premium,
        // preferredResolution(playback.wifiQuality))} in VideoPlayer.tsx
        // exactly, including that this is also the ceiling the in-player
        // Quality menu itself offers (see _availableQualityOptions above).
        final status = await premiumService.getStatus();
        final maxRes = effectiveMaxResolution(
          status.maxResolution,
          playbackSettings.wifiQuality,
        );
        _premiumCeilingHeight =
            int.tryParse(maxRes.replaceAll(RegExp(r'[^0-9]'), '')) ?? 1080;
        _autoPipEnabled = playbackSettings.pip;
        final videoUrl = _muxUrl(video.muxPlaybackId!, maxRes);
        _videoController = VideoPlayerController.networkUrl(
          Uri.parse(videoUrl),
        );

        try {
          await _videoController!.initialize();
          _videoController!.addListener(_onPlayerTick);
          _isInitialized = true;
          await _applyResumePosition();
        } catch (e) {
          _logger.e('Error initializing video player: $e');
          _isInitialized = false;
        }
      }

      if (!mounted) return;

      // Paint the player the instant the video itself is ready.
      //
      // This setState used to sit AFTER `await videoService.getVideos()`
      // below, so the entire recommended-videos feed — a second full
      // network round trip, unrelated to playback — had to come back before
      // _isLoading flipped and the player was built at all. On a slow
      // connection that left a spinner sitting over a fully initialized,
      // ready-to-play video for seconds. Worse, play() was being called
      // inside that window, into a VideoPlayer widget that did not exist in
      // the tree yet, so the stream could start advancing (and on some
      // devices start making sound) before any picture appeared, and the
      // frame you eventually got was already out of sync with the controls.
      // Recommendations are not part of the player and no longer gate it.
      setState(() {
        _video = video;
        _isLoading = false;
      });

      // Only now, with the surface actually mounted, start playback.
      if (_isInitialized) _videoController?.play();

      // Recommendations load in the background and fill in when they land.
      unawaited(
        videoService
            .getVideos()
            .then((recommended) {
              if (!mounted) return;
              setState(() {
                _recommendedVideos = recommended
                    .where((v) => v.videoId != widget.videoId)
                    .toList();
              });
            })
            .catchError((Object e) {
              _logger.w('Could not load recommended videos: $e');
            }),
      );

      // Record the watch the moment a real video/track has loaded on this
      // page — mirrors the website's own "you opened this" semantics rather
      // than gating on the player actually starting playback. Fire-and-
      // forget: a failed history write should never block or interrupt
      // watching, so recordWatch() already swallows its own errors and
      // just returns false.
      unawaited(ref.read(historyServiceProvider).recordWatch(video.videoId));
      unawaited(_loadCaptions(video.videoId));

      _loadEngagementState(video);
    } catch (e) {
      _logger.e('Error loading video: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _loadEngagementState(Video video) {
    _loadLikeStatus(video.videoId);
    _loadWatchlistStatus(video.videoId);
    _loadComments(video.videoId);

    if (video.uploaderId != null && video.uploaderId!.isNotEmpty) {
      _loadSubscriptionStatus(video.uploaderId!);
    }
  }

  Future<void> _loadLikeStatus(String videoId) async {
    final status = await ref.read(likeServiceProvider).getStatus(videoId);
    if (!mounted) return;
    setState(() {
      _likeCount = (status['likeCount'] as num?)?.toInt() ?? 0;
      _dislikeCount = (status['dislikeCount'] as num?)?.toInt() ?? 0;
      _myReaction = status['myReaction'] as String?;
    });
  }

  Future<void> _loadWatchlistStatus(String videoId) async {
    final saved = await ref.read(watchlistServiceProvider).isSaved(videoId);
    if (!mounted) return;
    setState(() => _isSaved = saved);
  }

  Future<void> _loadComments(String videoId) async {
    setState(() => _commentsLoading = true);
    final comments = await ref
        .read(commentServiceProvider)
        .getComments(videoId);
    if (!mounted) return;
    setState(() {
      _comments = comments;
      _commentsLoading = false;
    });
  }

  Future<void> _loadSubscriptionStatus(String creatorId) async {
    final status = await ref
        .read(channelServiceProvider)
        .getSubscriptionStatus(creatorId);
    if (!mounted || status == null) return;
    setState(() {
      _isSubscribed = status['isSubscribed'] == true;
      _subscriberCount = (status['subscriberCount'] as num?)?.toInt();
    });
  }

  Future<void> _toggleReaction(String action) async {
    final video = _video;
    if (video == null || _likeBusy) return;

    final prevReaction = _myReaction;
    final prevLike = _likeCount;
    final prevDislike = _dislikeCount;
    final effective = prevReaction == action ? 'remove' : action;

    setState(() {
      _likeBusy = true;
      if (prevReaction == 'like' && _likeCount > 0) _likeCount--;
      if (prevReaction == 'dislike' && _dislikeCount > 0) _dislikeCount--;
      if (effective == 'like') _likeCount++;
      if (effective == 'dislike') _dislikeCount++;
      _myReaction = effective == 'remove' ? null : effective;
    });

    final ok = await ref
        .read(likeServiceProvider)
        .react(video.videoId, effective);

    if (!mounted) return;

    if (!ok) {
      setState(() {
        _myReaction = prevReaction;
        _likeCount = prevLike;
        _dislikeCount = prevDislike;
      });
      _showSnack('Sign in to react to videos.');
    }

    setState(() => _likeBusy = false);
  }

  Future<void> _toggleWatchlist() async {
    final video = _video;
    if (video == null || _watchlistBusy) return;

    final prev = _isSaved;
    setState(() {
      _watchlistBusy = true;
      _isSaved = !prev;
    });

    final service = ref.read(watchlistServiceProvider);
    final ok = prev
        ? await service.remove(video.videoId)
        : await service.add(video.videoId);

    if (!mounted) return;

    if (!ok) {
      setState(() => _isSaved = prev);
      _showSnack(
        prev ? "Couldn't remove from Watch Later." : 'Sign in to save videos.',
      );
    } else {
      _showSnack(
        _isSaved ? 'Saved to Watch Later' : 'Removed from Watch Later',
      );
    }

    setState(() => _watchlistBusy = false);
  }

  void _share() {
    final video = _video;
    if (video == null) return;
    final url = 'https://inplayer.in/watch/${video.videoId}';
    SharePlus.instance.share(
      ShareParams(text: '${video.title}\n$url', subject: video.title),
    );
  }

  // ---------------- Download ----------------
  //
  // Wires up the real download backend that already exists on the website
  // (app/api/videos/[videoId]/{prepare-download,download}, app/api/videos/
  // [videoId]/status) but was deliberately never linked to from any
  // website UI — app/downloads/page.tsx says outright this is meant for
  // the app. See DownloadService for the endpoint calls and
  // DownloadManager for the actual file transfer + local library.
  //
  // Most videos already have a downloadable MP4 requested the moment
  // they're uploaded (see app/api/upload/create), so prepare-download
  // usually just confirms "ready" almost immediately; it only takes real
  // time to backfill a video uploaded before this existed.

  Future<void> _handleDownloadTap() async {
    final video = _video;
    if (video == null || _downloadPreparing) return;

    if (video.contentType == 'short') {
      _showSnack("Shorts can't be downloaded yet.");
      return;
    }

    final manager = ref.read(downloadManagerProvider);
    if (manager.isDownloaded(video.videoId)) {
      context.push('/downloads');
      return;
    }
    if (manager.taskFor(video.videoId) != null) {
      _showSnack('Already downloading — check Downloads for progress.');
      return;
    }

    setState(() => _downloadPreparing = true);

    final downloadService = ref.read(downloadServiceProvider);
    final prepared = await downloadService.prepareDownload(video.videoId);

    if (!mounted) return;

    if (prepared.status == 'unauthenticated') {
      setState(() => _downloadPreparing = false);
      _showSnack('Sign in to download videos.');
      return;
    }
    if (prepared.status == 'unavailable') {
      setState(() => _downloadPreparing = false);
      _showSnack(prepared.error ?? "This video can't be downloaded.");
      return;
    }
    if (prepared.status == 'error') {
      setState(() => _downloadPreparing = false);
      _showSnack("Couldn't start preparing this download. Please try again.");
      return;
    }

    // Poll the same /status endpoint the upload flow already polls
    // (upload_service.dart's checkStatus) — it also carries
    // downloadStatus/downloadRenditions. ~2 minutes of polling covers a
    // real encode; a video already prepared at upload time resolves on
    // the very first check.
    Map<String, String> renditions = {};
    for (var attempt = 0; attempt < 24; attempt++) {
      if (!mounted) return;
      final status = await downloadService.checkDownloadStatus(video.videoId);
      if (status.downloadStatus == 'ready' && status.renditions.isNotEmpty) {
        renditions = status.renditions;
        break;
      }
      if (status.downloadStatus == 'errored') break;
      await Future.delayed(const Duration(seconds: 5));
    }

    if (!mounted) return;
    setState(() => _downloadPreparing = false);

    if (renditions.isEmpty) {
      _showSnack('Still preparing this download — try again in a moment.');
      return;
    }

    _showDownloadQualityPicker(video, renditions);
  }

  void _showDownloadQualityPicker(Video video, Map<String, String> renditions) {
    const order = ['1080p', '720p', '480p', 'audio-only'];
    final available = order.where(renditions.containsKey).toList();
    if (available.isEmpty) available.addAll(renditions.keys);

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: ctx.bgModal,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: ctx.borderSubtle),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: ctx.textDim.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Download quality',
                style: TextStyle(
                  color: ctx.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                video.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: ctx.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 12),
              for (final quality in available)
                InkWell(
                  onTap: () {
                    Navigator.pop(ctx);
                    _startDownload(video, quality, renditions[quality]!);
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    margin: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        Icon(
                          video.isMusic ? Icons.music_note : Icons.hd_outlined,
                          color: ctx.textPrimary,
                          size: 18,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _downloadQualityLabel(quality),
                            style: TextStyle(
                              color: ctx.textPrimary,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(
                          Icons.download_outlined,
                          color: ctx.textDim,
                          size: 18,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  String _downloadQualityLabel(String quality) {
    switch (quality) {
      case '1080p':
        return '1080p · Full HD';
      case '720p':
        return '720p · HD';
      case '480p':
        return '480p · Data saver';
      case 'audio-only':
        return 'Audio (M4A)';
      default:
        return quality;
    }
  }

  void _startDownload(Video video, String quality, String fileName) {
    ref
        .read(downloadManagerProvider)
        .download(video: video, quality: quality, fileName: fileName)
        .then((_) {
          if (mounted) _showSnack('Downloaded — find it in Downloads.');
        })
        .catchError((Object _) {
          if (mounted)
            _showSnack("Couldn't finish downloading. Please try again.");
        });
  }

  void _confirmCancelDownload(String videoId) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel download?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Keep downloading'),
          ),
          TextButton(
            onPressed: () {
              ref.read(downloadManagerProvider).cancelDownload(videoId);
              Navigator.pop(ctx);
            },
            child: const Text('Cancel download'),
          ),
        ],
      ),
    );
  }

  Future<void> _toggleSubscribe() async {
    final video = _video;
    if (video == null ||
        video.uploaderId == null ||
        video.uploaderId!.isEmpty) {
      return;
    }
    if (_subscribeBusy) return;

    final wasSubscribed = _isSubscribed;
    setState(() {
      _subscribeBusy = true;
      _isSubscribed = !wasSubscribed;
      _subscriberCount = (_subscriberCount ?? 0) + (wasSubscribed ? -1 : 1);
    });

    final service = ref.read(channelServiceProvider);
    final ok = wasSubscribed
        ? await service.unsubscribeFromChannel(video.uploaderId!)
        : await service.subscribeToChannel(video.uploaderId!);

    if (!mounted) return;

    if (!ok) {
      setState(() {
        _isSubscribed = wasSubscribed;
        _subscriberCount = (_subscriberCount ?? 0) + (wasSubscribed ? 1 : -1);
      });
      _showSnack('Sign in to subscribe.');
    }

    setState(() => _subscribeBusy = false);
  }

  Future<void> _postComment() async {
    final video = _video;
    final text = _commentController.text.trim();
    if (video == null || text.isEmpty || _postingComment) return;

    setState(() => _postingComment = true);

    final result = await ref
        .read(commentServiceProvider)
        .postComment(video.videoId, text);

    if (!mounted) return;
    setState(() => _postingComment = false);

    if (result.requiresSignIn) {
      _showSnack('Sign in to comment.');
      return;
    }

    if (result.flagged) {
      _commentController.clear();
      _showSnack('Your comment was submitted for review.');
      return;
    }

    if (result.success) {
      _commentController.clear();
      setState(() => _comments = [result.comment!, ..._comments]);
    } else {
      _showSnack(result.error ?? "Couldn't post your comment.");
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.surfaceDark),
    );
  }

  String _formatCount(int count) {
    if (count >= 1000000) return '${(count / 1000000).toStringAsFixed(1)}M';
    if (count >= 1000) return '${(count / 1000).toStringAsFixed(1)}K';
    return count.toString();
  }

  @override
  Widget build(BuildContext context) {
    // While the OS has actually floated this Activity into its small
    // system PiP window, render nothing but the raw video frame — there's
    // no room for (and no touch access to) the normal player chrome or
    // info panel, and Android itself overlays its own minimal
    // play/pause/close controls on top of whatever the app renders here.
    if (_inPip) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: _isInitialized && _videoController != null
            ? _buildMediaSurface()
            : const SizedBox(),
      );
    }
    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              // Video Player
              AspectRatio(
                aspectRatio: 16 / 9,
                child: _isLoading
                    ? Container(
                        color: Colors.black,
                        child: const Center(
                          child: CircularProgressIndicator(
                            color: AppColors.brandOrange,
                          ),
                        ),
                      )
                    : _isInitialized && _videoController != null
                    ? Stack(
                        alignment: Alignment.center,
                        children: [
                          _buildMediaSurface(),
                          Positioned.fill(
                            child: PlayerChrome(
                              controller: _videoController!,
                              title: _video?.title ?? '',
                              isFullscreen: false,
                              onToggleFullscreen: _openFullscreen,
                              onBack: () {
                                if (context.canPop()) {
                                  context.pop();
                                } else {
                                  context.go('/');
                                }
                              },
                              qualityLabel: _qualityLabel,
                              qualityOptions: _availableQualityOptions,
                              onQualityChange: _switchQuality,
                              captionLanguages: _captionLanguages,
                              selectedCaptionLang: _selectedCaptionLang,
                              captionCues: _captionCues,
                              onCaptionLanguageChange: _selectCaptionLanguage,
                              pipSupported: _pipSupported,
                              onPipTapped: _enterPip,
                              onMinimize: _minimizeToMiniPlayer,
                              initialBrightness: _playerBrightness,
                              onBrightnessChanged: (v) =>
                                  setState(() => _playerBrightness = v),
                            ),
                          ),
                        ],
                      )
                    : Container(
                        color: Colors.black,
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.error_outline,
                                size: 64,
                                color: Colors.white,
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'Video not available',
                                style: TextStyle(color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                      ),
              ),
              // Video Info
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 20,
                  ),
                  // Was `_video != null ? ... : _buildPlaceholderInfo()` with
                  // no loading check — on a fresh open, `_video` is null for
                  // the entire time `_loadVideo()` is in flight, so this
                  // flashed the "Video unavailable" not-found placeholder
                  // (title + "could not be found" copy) for every video,
                  // every time, until the real fetch resolved. Only fall
                  // through to that genuine not-found state once loading has
                  // actually finished.
                  child: _isLoading
                      ? const SizedBox.shrink()
                      : _video != null
                      ? _buildVideoInfo(_video!)
                      : _buildPlaceholderInfo(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Player brightness, owned here rather than inside PlayerChrome.
  ///
  /// PlayerChrome owns the left-half swipe *gesture* (it has to — that
  /// recognizer is shared with the tap-to-seek chain), but it renders on top
  /// of the video, not around it, so a ColorFilter applied inside it could
  /// only ever tint its own icons and scrims. That is exactly what was
  /// happening: dragging moved the on-screen indicator and left the picture
  /// completely untouched. The value is reported up here instead and applied
  /// to the media surface itself.
  double _playerBrightness = 1.0;

  // The media surface (music cover/lyrics stage, or the plain video frame) —
  // shared between the inline player and FullscreenPlayerPage so fullscreen
  // shows exactly the same surface, not a re-derived one. That sharing is
  // also why the brightness filter belongs here: applying it once covers
  // both players.
  Widget _buildMediaSurface() {
    final surface = _buildRawMediaSurface();
    // 1.0 is the identity matrix, so skip the ColorFiltered layer entirely
    // (it forces a saveLayer, which isn't free on every frame of video)
    // unless the viewer has actually moved brightness off default.
    if (_playerBrightness == 1.0) return surface;
    final b = _playerBrightness;
    return ColorFiltered(
      // Reproduces the website's CSS `filter: brightness(x)` — every RGB
      // channel scaled by the same factor, alpha untouched. Above 1
      // brightens and clips toward white, below 1 dims.
      colorFilter: ColorFilter.matrix(<double>[
        b,
        0,
        0,
        0,
        0,
        0,
        b,
        0,
        0,
        0,
        0,
        0,
        b,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
      ]),
      child: surface,
    );
  }

  Widget _buildRawMediaSurface() {
    final video = _video;
    final controller = _videoController;
    if (video == null || controller == null) return const SizedBox();
    if (video.isMusic) {
      return MusicStage(
        covers: video.covers,
        coverIntervalSeconds: video.coverIntervalSeconds,
        lyrics: video.lyrics,
        currentTime: controller.value.position.inMilliseconds / 1000.0,
        durationSeconds: controller.value.duration.inMilliseconds / 1000.0,
        title: video.title,
        artist: video.artist ?? video.creator,
      );
    }
    return VideoPlayer(controller);
  }

  Future<void> _openFullscreen() async {
    if (_videoController == null || _inFullscreen) return;
    _inFullscreen = true;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => FullscreenPlayerPage(
          getController: () => _videoController!,
          getMediaSurface: _buildMediaSurface,
          title: _video?.title ?? '',
          getQualityLabel: () => _qualityLabel,
          qualityOptions: _availableQualityOptions,
          onQualityChange: _switchQuality,
          captionLanguages: _captionLanguages,
          getSelectedCaptionLang: () => _selectedCaptionLang,
          getCaptionCues: () => _captionCues,
          onCaptionLanguageChange: _selectCaptionLanguage,
          pipSupported: _pipSupported,
          onPipTapped: _enterPip,
          // Brightness lives on this page (see _playerBrightness), because
          // this page owns the media surface both players render. A getter
          // rather than a plain value so fullscreen opens at whatever the
          // inline player was last set to.
          getBrightness: () => _playerBrightness,
          onBrightnessChanged: (v) {
            if (mounted) setState(() => _playerBrightness = v);
          },
        ),
      ),
    );
    _inFullscreen = false;
    // A quality change made while fullscreen was open swaps _videoController
    // to a new instance (see _switchQuality) — refresh so the inline player
    // picks it up too once back here.
    if (mounted) setState(() {});
  }

  /// Hands the live, already-playing controller off to the app-wide
  /// VideoMiniPlayerService and leaves this page — playback continues
  /// uninterrupted in the small draggable corner window (see
  /// VideoMiniPlayerOverlay in home_page.dart) instead of stopping, the way
  /// popping this page normally would. Removing the listener first (rather
  /// than leaving it for dispose() to clean up) matters here specifically:
  /// this page is about to become unmounted while the controller itself
  /// keeps running, so without this, every future tick would still call
  /// back into a dead page's _maybeSavePlaybackPosition/PiP-state logic.
  /// `_videoController` is set to null (not disposed) right after handing
  /// it over, so dispose() below — which only ever acts when the field is
  /// non-null — naturally leaves the now-service-owned controller alone.
  void _minimizeToMiniPlayer() {
    final controller = _videoController;
    final video = _video;
    if (controller == null || video == null || !_isInitialized) return;
    controller.removeListener(_onPlayerTick);
    ref
        .read(videoMiniPlayerServiceProvider)
        .activate(controller: controller, video: video);
    _videoController = null;
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  Widget _buildVideoInfo(Video video) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          video.title,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: context.textPrimary,
            height: 1.3,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            const Icon(
              Icons.remove_red_eye_outlined,
              size: 15,
              color: AppColors.brandOrange,
            ),
            const SizedBox(width: 4),
            Text(
              '${video.views} views',
              style: TextStyle(color: context.textSecondary, fontSize: 12.5),
            ),
            const SizedBox(width: 10),
            Text('•', style: TextStyle(color: context.textDim)),
            const SizedBox(width: 10),
            const Icon(Icons.schedule, size: 15, color: AppColors.brandOrange),
            const SizedBox(width: 4),
            Text(
              video.uploaded,
              style: TextStyle(color: context.textSecondary, fontSize: 12.5),
            ),
            if (video.category.isNotEmpty) ...[
              const SizedBox(width: 10),
              Text('•', style: TextStyle(color: context.textDim)),
              const SizedBox(width: 10),
              Text(
                video.category,
                style: const TextStyle(
                  color: AppColors.brandOrange,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 16),

        // Creator Row & Subscribe Button
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: context.isDark
                ? Colors.white.withValues(alpha: 0.05)
                : Colors.black.withValues(alpha: 0.03),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: context.borderSubtle, width: 1),
          ),
          child: Row(
            children: [
              UserAvatar(
                avatarUrl: video.avatar,
                name: video.creator,
                size: 38,
                isVerified: video.verified,
                onTap: video.uploaderUsername == null
                    ? null
                    : () => context.push('/channel/${video.uploaderUsername}'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: video.uploaderUsername == null
                      ? null
                      : () =>
                            context.push('/channel/${video.uploaderUsername}'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              video.creator,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: context.textPrimary,
                                fontWeight: FontWeight.w800,
                                fontSize: 13.5,
                              ),
                            ),
                          ),
                          if (video.verified) ...[
                            const SizedBox(width: 4),
                            const Icon(
                              Icons.verified,
                              size: 14,
                              color: AppColors.brandGold,
                            ),
                          ],
                        ],
                      ),
                      if (video.uploaderUsername != null)
                        Text(
                          '@${video.uploaderUsername}',
                          style: TextStyle(
                            color: context.textDim,
                            fontSize: 11,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              if (video.uploaderId != null && video.uploaderId!.isNotEmpty)
                GestureDetector(
                  onTap: _toggleSubscribe,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      gradient: _isSubscribed ? null : AppColors.flameGradient,
                      color: _isSubscribed
                          ? (context.isDark
                                ? Colors.white.withValues(alpha: 0.12)
                                : Colors.black.withValues(alpha: 0.08))
                          : null,
                      borderRadius: BorderRadius.circular(20),
                      border: _isSubscribed
                          ? Border.all(color: context.borderSubtle)
                          : null,
                    ),
                    child: Text(
                      _isSubscribed ? 'In-family' : 'Join In-family',
                      style: TextStyle(
                        color: _isSubscribed
                            ? context.textPrimary
                            : Colors.black,
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // Action Bar (Like, Dislike, Share, Download, Save)
        _buildActionBar(video),

        const SizedBox(height: 14),

        // Description Box
        _buildDescriptionBox(video),

        const SizedBox(height: 24),
        _buildCommentsSection(),
        const SizedBox(height: 24),
        _buildAdBanner(),
        const SizedBox(height: 24),
        _buildRecommendedVideos(),
      ],
    );
  }

  Widget _buildAdBanner() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Stack(
          children: [
            Container(
              width: double.infinity,
              height: 180,
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(16),
                image: const DecorationImage(
                  // We'll use a placeholder since it's an ad
                  image: AssetImage('assets/images/placeholder_ad.png'),
                  fit: BoxFit.cover,
                ),
              ),
              child: _video == null
                  ? null
                  : CachedNetworkImage(
                      imageUrl:
                          _video!.thumbnail, // fallback to video thumbnail
                      fit: BoxFit.cover,
                      errorWidget: (context, error, stackTrace) =>
                          const SizedBox(),
                    ),
            ),
            Positioned(
              top: 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'AD',
                  style: TextStyle(
                    color: AppColors.brandGold,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.brandOrange.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Text(
                'AD',
                style: TextStyle(
                  color: AppColors.brandOrange,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  '15 August Trailer',
                  style: TextStyle(
                    color: AppColors.textPrimaryLight,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                Text(
                  'Sponsored',
                  style: TextStyle(color: Colors.blueAccent, fontSize: 12),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildActionBar(Video video) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: context.isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildActionItem(
            icon: _myReaction == 'like'
                ? Icons.thumb_up_alt
                : Icons.thumb_up_alt_outlined,
            label: _likeCount > 0 ? _formatCount(_likeCount) : 'Like',
            active: _myReaction == 'like',
            onTap: () => _toggleReaction('like'),
          ),
          _buildActionItem(
            icon: _myReaction == 'dislike'
                ? Icons.thumb_down_alt
                : Icons.thumb_down_alt_outlined,
            label: _dislikeCount > 0 ? _formatCount(_dislikeCount) : 'Dislike',
            active: _myReaction == 'dislike',
            onTap: () => _toggleReaction('dislike'),
          ),
          _buildActionItem(
            icon: Icons.reply_outlined,
            label: 'Share',
            onTap: _share,
          ),
          _buildDownloadActionItem(),
          _buildActionItem(
            icon: _isSaved ? Icons.bookmark : Icons.bookmark_outline,
            label: _isSaved ? 'Saved' : 'Save',
            active: _isSaved,
            onTap: _toggleWatchlist,
          ),
          _buildActionItem(
            icon: Icons.more_horiz,
            label: 'More',
            onTap: () => showVideoOptionsSheet(context, video),
          ),
        ],
      ),
    );
  }

  Widget _buildActionItem({
    required IconData icon,
    required String label,
    bool active = false,
    VoidCallback? onTap,
  }) {
    final color = active ? AppColors.brandOrange : context.textPrimary;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// The Download slot in the action bar reacts live to
  /// DownloadManager's state — preparing / a live progress ring while a
  /// transfer is running / a filled "Downloaded" state once it's on this
  /// device — rather than the plain static icon+label every other action
  /// bar item is.
  Widget _buildDownloadActionItem() {
    final video = _video;
    if (video == null) {
      return _buildActionItem(
        icon: Icons.download_outlined,
        label: 'Download',
        onTap: null,
      );
    }

    if (video.contentType == 'short') {
      return _buildActionItem(
        icon: Icons.download_outlined,
        label: 'Download',
        onTap: () => _showSnack("Shorts can't be downloaded yet."),
      );
    }

    if (_downloadPreparing) {
      return _buildActionItem(
        icon: Icons.hourglass_top_outlined,
        label: 'Preparing…',
        onTap: null,
      );
    }

    final manager = ref.watch(downloadManagerProvider);
    final task = manager.taskFor(video.videoId);

    if (task != null) {
      final pct = (task.progress * 100).clamp(0, 100).toStringAsFixed(0);
      return Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _confirmCancelDownload(video.videoId),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    value: task.progress > 0 ? task.progress : null,
                    color: AppColors.brandOrange,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '$pct%',
                  style: const TextStyle(
                    color: AppColors.brandOrange,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final isDownloaded = manager.isDownloaded(video.videoId);
    return _buildActionItem(
      icon: isDownloaded ? Icons.download_done : Icons.download_outlined,
      label: isDownloaded ? 'Downloaded' : 'Download',
      active: isDownloaded,
      onTap: _handleDownloadTap,
    );
  }

  Widget _buildDescriptionBox(Video video) {
    final description = video.description?.trim() ?? '';
    return GestureDetector(
      onTap: () {
        setState(() {
          _descExpanded = !_descExpanded;
        });
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: context.isDark
              ? Colors.white.withValues(alpha: 0.04)
              : Colors.black.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: context.borderSubtle),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              description.isNotEmpty ? description : 'No description provided.',
              maxLines: _descExpanded ? null : 2,
              overflow: _descExpanded ? null : TextOverflow.ellipsis,
              style: TextStyle(
                color: context.textSecondary,
                fontSize: 13,
                height: 1.45,
              ),
            ),
            if (description.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                _descExpanded ? 'Show less' : 'Show more',
                style: const TextStyle(
                  color: AppColors.brandOrange,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCommentsSection() {
    final isSignedIn = ref.watch(authStateProvider) is AuthStateAuthenticated;
    final visibleComments = _commentsExpanded
        ? _comments
        : _comments.take(3).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${_comments.length} Comments',
          style: TextStyle(
            color: context.textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: context.isDark
                  ? AppColors.surfaceDark
                  : AppColors.surfaceLight,
              child: Icon(Icons.person, size: 20, color: context.textSecondary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: context.isDark
                          ? Colors.white.withValues(alpha: 0.05)
                          : Colors.black.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: context.borderSubtle),
                    ),
                    child: TextField(
                      controller: _commentController,
                      enabled: !_postingComment,
                      style: TextStyle(
                        color: context.textPrimary,
                        fontSize: 13,
                      ),
                      minLines: 1,
                      maxLines: 4,
                      onSubmitted: (_) => _postComment(),
                      decoration: InputDecoration(
                        isDense: true,
                        hintText: isSignedIn
                            ? 'Write a comment...'
                            : 'Sign in to comment...',
                        hintStyle: TextStyle(
                          color: context.textDim,
                          fontSize: 13,
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(
                        Icons.emoji_emotions_outlined,
                        size: 20,
                        color: context.textDim,
                      ),
                      const SizedBox(width: 12),
                      Icon(
                        Icons.image_outlined,
                        size: 20,
                        color: context.textDim,
                      ),
                      const SizedBox(width: 12),
                      Icon(
                        Icons.gif_box_outlined,
                        size: 20,
                        color: context.textDim,
                      ),
                      const Spacer(),
                      if (_postingComment)
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation(
                              AppColors.brandOrange,
                            ),
                          ),
                        )
                      else if (_commentController.text.isNotEmpty)
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          icon: const Icon(
                            Icons.send,
                            size: 20,
                            color: AppColors.brandOrange,
                          ),
                          onPressed: _postComment,
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (_commentsLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.brandOrange,
                ),
              ),
            ),
          )
        else if (_comments.isEmpty)
          Text(
            'No comments yet. Be the first to say something.',
            style: TextStyle(color: context.textSecondary),
          )
        else ...[
          const SizedBox(height: 16),
          ...visibleComments.map(_buildCommentTile),
        ],
        if (!_commentsExpanded && _comments.length > 3)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: GestureDetector(
              onTap: () => setState(() => _commentsExpanded = true),
              child: const Text(
                'Show all comments',
                style: TextStyle(
                  color: AppColors.brandOrange,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildCommentTile(Comment comment) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UserAvatar(
            avatarUrl: comment.userAvatarUrl,
            name: comment.userName,
            size: 28,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        comment.userName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: context.textPrimary,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (comment.isVerified) ...[
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.verified,
                        size: 12,
                        color: AppColors.brandGold,
                      ),
                    ],
                    if (comment.isMember) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.brandOrange.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'Member',
                          style: TextStyle(
                            color: AppColors.brandOrange,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(width: 6),
                    Text(
                      comment.timeAgo,
                      style: TextStyle(color: context.textDim, fontSize: 11),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  comment.text,
                  style: TextStyle(
                    color: context.textSecondary,
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecommendedVideos() {
    if (_recommendedVideos.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.isDark
            ? Colors.white.withValues(alpha: 0.04)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 4,
                height: 16,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.brandOrange, AppColors.brandGold],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'KEEP WATCHING',
                style: TextStyle(
                  color: AppColors.brandOrange,
                  fontWeight: FontWeight.bold,
                  fontSize: 10,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Up Next',
            style: TextStyle(
              color: context.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 16),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _recommendedVideos.length > 5
                ? 5
                : _recommendedVideos.length,
            separatorBuilder: (context, index) => const SizedBox(height: 16),
            itemBuilder: (context, index) {
              final rec = _recommendedVideos[index];
              return GestureDetector(
                onTap: () {
                  context.pushReplacement('/watch/${rec.videoId}');
                },
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 140,
                      height: 80,
                      decoration: BoxDecoration(
                        color: context.isDark
                            ? AppColors.surfaceDark
                            : AppColors.surfaceLight,
                        borderRadius: BorderRadius.circular(12),
                        image: smartImageProvider(rec.thumbnail) != null
                            ? DecorationImage(
                                image: smartImageProvider(rec.thumbnail)!,
                                fit: BoxFit.cover,
                              )
                            : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            // Website's related-videos title (VideoCard.tsx)
                            // is normal case, not all-caps — this previously
                            // shouted every recommendation for no reason.
                            rec.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: context.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            rec.creator,
                            style: TextStyle(
                              color: context.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${rec.views} views • ${rec.uploaded}',
                            style: TextStyle(
                              color: context.textDim,
                              fontSize: 11,
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
        ],
      ),
    );
  }

  Widget _buildPlaceholderInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Video unavailable',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: context.textPrimary,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          "This video could not be found. It may have been removed, or the link may be incorrect.",
          style: TextStyle(color: context.textSecondary),
        ),
      ],
    );
  }
}
