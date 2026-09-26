import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../../../../core/router/pageless_route_observer.dart';
import '../../../../core/widgets/pattern_background.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../core/utils/playback_position_store.dart';
import '../../../../core/utils/playback_settings_store.dart';
import '../../../../core/utils/video_preview_gate.dart';
import '../../../../core/utils/webvtt_parser.dart';
import '../../../../services/video_mini_player_service.dart';
import '../widgets/music_stage.dart';
import '../widgets/player_chrome.dart';
import '../widgets/video_options_sheet.dart';
import '../widgets/comment_thread_tile.dart';
import 'fullscreen_player_page.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../services/ad_service.dart';

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
  // Latched once (see _onPlayerTick) the first time a real decoded frame has
  // actually rendered to the texture — deliberately NOT recomputed live from
  // controller.value on every build. See the comment in
  // _buildRawMediaSurface() for why: a live check flickers.
  bool _firstFrameRendered = false;
  bool _isLoading = true;
  bool _hasPlayerError = false;
  Video? _video;
  bool _descExpanded = false;
  List<Video> _recommendedVideos = [];

  // Video ad monetization: pre-roll, mid-roll, post-roll (matches VideoPlayer.tsx ad flows)
  MidrollConfig? _midrollConfig;
  MidrollAd? _currentMidrollAd;
  bool _midrollBreakActive = false;
  String _adBreakType = 'midroll'; // 'preroll', 'midroll', 'postroll'
  bool _prerollShown = false;
  bool _postrollShown = false;
  bool _isPremium = false;
  bool _midrollSkipUnlocked = false;
  int _midrollCountdown = 0;
  final ValueNotifier<int> _adStateRevision = ValueNotifier<int>(0);
  final Set<int> _midrollBreaksShown = {};
  bool _midrollWasPlaying = false;
  Timer? _midrollTimer;
  VideoPlayerController? _adVideoController;
  // Pre-warmed ad video controller so a Mux mid-roll doesn't cold-start
  // (network fetch + HLS init) only at break time. Keyed by the ad's
  // "mux:" imageUrl so it is only reused for the exact same creative.
  VideoPlayerController? _preloadedAdController;
  String? _preloadedAdKey;

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
    SystemChrome.setPreferredOrientations([]);
    WidgetsBinding.instance.addObserver(this);
    // A muted feed preview is a second hardware video decoder, and this
    // page is about to open a full one. See VideoPreviewGate.suspend —
    // two concurrent AVC decoders is what corrupted and stalled playback
    // on several chipsets, so the feed hands its decoder over while a
    // full-screen player is up.
    VideoPreviewGate.instance.suspend();
    PipService.register(this, _handlePipModeChanged);
    unawaited(() async {
      final supported = await PipService.isSupported();
      if (mounted) setState(() => _pipSupported = supported);
    }());
    _loadVideo();
  }

  // This page's own route, cached for _maybeUpdatePipPlaybackState(), which
  // runs from a controller listener outside build().
  ModalRoute<dynamic>? _route;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _route = ModalRoute.of(context);
  }

  @override
  void dispose() {
    SystemChrome.setPreferredOrientations([]);
    VideoPreviewGate.instance.resume();
    WidgetsBinding.instance.removeObserver(this);
    // Drops this page from PipService, which re-reports auto-PiP from the
    // pages still open (false when none are). Forcing it off here used to
    // disable auto-PiP for a watch page still playing underneath this one.
    PipService.unregister(this);
    _midrollTimer?.cancel();
    final adCtrl = _adVideoController;
    _adVideoController = null;
    if (adCtrl != null) {
      adCtrl.removeListener(_onAdVideoTick);
      adCtrl.dispose();
    }
    final preAdCtrl = _preloadedAdController;
    _preloadedAdController = null;
    _preloadedAdKey = null;
    preAdCtrl?.dispose();
    _videoController?.removeListener(_onPlayerTick);
    _videoController?.dispose();
    _commentController.dispose();
    _adStateRevision.dispose();
    super.dispose();
  }

  // The OS actually entering/exiting PiP (not just a request being made —
  // enterPip()/the OS can still decline). If a landscape FullscreenPlayerPage
  // route was showing when this fires, remove it: its full player chrome
  // doesn't belong in a tiny floating window, and this page's own bare-video
  // PiP layout (see build()) is what should show while floating.
  void _handlePipModeChanged(bool isInPip) {
    if (!mounted) return;
    setState(() => _inPip = isInPip);
    final own = _route;
    if (isInPip) {
      // Close everything above this page — the fullscreen player AND any
      // speed/quality/captions menu or comments sheet on top of it — so the
      // floating window shows only this page's bare video. Removing just the
      // fullscreen route left an open menu drawn over the PiP video, and that
      // menu then broke after returning (its owner State was disposed).
      // popUntil stops at this page, so it can never pop the page itself; and
      // it only runs when nothing but those transient routes is above us, so
      // a different screen the viewer navigated to is never closed.
      if (own != null && own.isActive && !own.isCurrent && _pipOnScreen) {
        Navigator.of(context).popUntil((r) => r == own);
      }
    } else {
      // Expanding back out of PiP while holding the phone sideways fires the
      // metrics change while _inPip is still true, so the auto-fullscreen
      // check ignored it. Re-check once the layout has settled.
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _maybeAutoFullscreenOnRotate(),
      );
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    // Same reason as the post-frame re-check above: a rotation that happened
    // while the app wasn't resumed was ignored by _maybeAutoFullscreenOnRotate.
    if (state == AppLifecycleState.resumed) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _maybeAutoFullscreenOnRotate(),
      );
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
    if (!mounted || _inFullscreen || _inPip || _videoController == null) {
      return;
    }
    // Entering system Picture-in-Picture resizes this Activity's window to a
    // small (usually landscape 16:9) rectangle, which fires didChangeMetrics
    // exactly like a physical rotation — often BEFORE the native
    // onPipModeChanged callback has flipped _inPip. Without these guards the
    // PiP window itself was mistaken for "rotated to landscape" and pushed
    // FullscreenPlayerPage (full player chrome) on top of the bare-video PiP
    // layout: the overlapping, untappable buttons in the floating window.
    // The Activity is paused (Flutter: not resumed) while in PiP, and a real
    // phone held in landscape is never under 300dp on its short side.
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    if (lifecycle != null && lifecycle != AppLifecycleState.resumed) return;
    final view = View.of(context);
    final size = view.physicalSize / view.devicePixelRatio;
    if (size.shortestSide < 300) return;
    if (size.width > size.height) {
      _openFullscreen();
    }
  }

  void _onPlayerTick() {
    // Latch the first-frame-rendered flag exactly once. This is the ONLY
    // place it flips true, and it's what _buildRawMediaSurface() gates the
    // video texture on instead of a live isPlaying check — see that method
    // for why a live check flickers.
    if (!_firstFrameRendered) {
      final value = _videoController?.value;
      if (value != null &&
          value.isInitialized &&
          value.isPlaying &&
          value.position > Duration.zero) {
        _firstFrameRendered = true;
        if (mounted) setState(() {});
      }
    }
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
    _handleMidrollTimeUpdate();
    _checkPostrollOnPlayerTick();
  }

  // Reports to the native side only when the value it would send changes
  // (this listener fires many times a second while playing), and only
  // "active" when the viewer has opted in to auto-PiP in Settings.
  //
  // Deduping on the SENT value rather than just play/pause matters:
  // _autoPipEnabled loads in the background after a network premium-status
  // call and _pipSupported is async too, so playback usually starts before
  // either is known. The old play/pause-only latch sent `false` once and
  // never re-armed, so pressing Home produced no floating window at all.
  //
  // Also only while this page (or its fullscreen player) is actually on
  // screen: PiP floats whatever route is on top, so arming it while another
  // page covers this one would float that page's buttons instead.
  void _maybeUpdatePipPlaybackState() {
    final playing = _videoController?.value.isPlaying ?? false;
    final suppressed = _pipSuppressedUntil != null &&
        DateTime.now().isBefore(_pipSuppressedUntil!);
    final active = playing &&
        _autoPipEnabled &&
        _pipSupported &&
        !suppressed &&
        _pipOnScreen;
    if (active == _lastPlayingForPip) return;
    _lastPlayingForPip = active;
    PipService.setActive(this, active);
  }

  // Whether PiP would float THIS page: it's the top route, or the only
  // things above it are its own fullscreen player and/or menus, sheets and
  // dialogs (which _handlePipModeChanged closes when PiP starts). False when
  // a different screen was opened over it — PiP would float that screen's
  // buttons instead of the video.
  bool get _pipOnScreen {
    final own = _route;
    if (own == null || own.isCurrent) return true;
    if (!own.isActive) return false;
    final fs = _fullscreenRoute;
    if (fs != null && fs.isCurrent) return true;
    return pagelessRouteObserver.onlyAbove(
      own,
      (r) => r is PopupRoute || identical(r, _fullscreenRoute),
    );
  }

  // Launching another app (share sheet, external link) counts as the user
  // leaving, so with auto-PiP armed Android would float this page into PiP
  // behind that app. Briefly disarm it around such launches; the next player
  // tick after the window re-arms it.
  DateTime? _pipSuppressedUntil;

  void _suppressAutoPipBriefly() {
    _pipSuppressedUntil = DateTime.now().add(const Duration(seconds: 2));
    _lastPlayingForPip = false;
    PipService.setActive(this, false);
  }

  // Throttled to once every ~4s (this listener fires many times a second) —
  // matches VideoPlayer.tsx's own `lastPositionSaveRef` throttle, and for
  // the same reason: a write on every tick would be a needless hot-path
  // write for a value nobody reads until the next time this video opens.
  void _maybeSavePlaybackPosition() {
    final controller = _videoController;
    final video = _video;
    if (controller == null || video == null || !controller.value.isInitialized) {
      return;
    }

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

      // Immediately render video metadata, channel details, and start loading comments/likes/watchlist
      if (mounted) {
        setState(() {
          _video = video;
          _isLoading = false;
          _hasPlayerError = false;
        });
        _loadEngagementState(video);
        unawaited(videoService.recordView(video.videoId));
        _midrollBreaksShown.clear();
        _prerollShown = false;
        _postrollShown = false;
        _finishMidroll('reset');
        _loadMidrollConfig();
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
        // The adopted controller has already been playing uninterrupted in
        // the mini player, so a real frame is already on screen — no need
        // to wait for the tick-based latch above.
        _firstFrameRendered = true;
        _resumeApplied = true;
      } else if (video.muxPlaybackId != null &&
          video.muxPlaybackId!.isNotEmpty) {
        final videoUrl = _muxUrl(video.muxPlaybackId!, '1080p');
        final controller = VideoPlayerController.networkUrl(
          Uri.parse(videoUrl),
          videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
        );
        _videoController = controller;

        // Fetch settings and premium tier in background without delaying player initialization
        unawaited(() async {
          try {
            final premiumService = ref.read(premiumServiceProvider);
            final playbackSettings = await PlaybackSettingsStore.get();
            final status = await premiumService.getStatus();
            final maxRes = effectiveMaxResolution(
              status.maxResolution,
              playbackSettings.wifiQuality,
            );
            if (mounted) {
              setState(() {
                _premiumCeilingHeight =
                    int.tryParse(maxRes.replaceAll(RegExp(r'[^0-9]'), '')) ?? 1080;
                _autoPipEnabled = playbackSettings.pip;
              });
            }
          } catch (_) {}
        }());

        try {
          await controller.initialize();
          // Forces ExoPlayer to decode and paint one real frame onto the
          // texture immediately, before playback visually starts. Without
          // this, `video_player` on Android can report isInitialized/
          // isPlaying and even a nonzero position slightly before the first
          // frame has actually been rendered to the texture — that gap is
          // what showed up as a brief black flash right when the player
          // became visible. Harmless if it fails; playback still starts
          // normally either way.
          try {
            await controller.seekTo(const Duration(milliseconds: 1));
          } catch (_) {}
          // The seekTo Future above resolves when ExoPlayer reports the seek
          // itself complete — not when the decoded frame has actually made
          // it through to the platform Surface/texture Flutter reads from.
          // That hand-off is a separate, unsynchronized step, and on some
          // devices it lags behind the seek-complete callback by more than
          // one frame, which is why the pre-warm alone still let a flash
          // through on some hardware even though it closed the gap on
          // others. A short, deliberate wall-clock wait here is a floor
          // that doesn't depend on what the plugin's Future actually
          // promises, on top of (not instead of) the seek above.
          await Future.delayed(const Duration(milliseconds: 100));
          if (!mounted) return;
          controller.addListener(_onPlayerTick);
          if (mounted) {
            setState(() {
              _isInitialized = true;
              _hasPlayerError = false;
            });
            if (!_prerollShown && !_isPremium && _midrollConfig != null && _midrollConfig!.enabled) {
              _maybeTriggerPreroll();
            } else {
              controller.play();
            }
          }
          await _applyResumePosition();
        } catch (e) {
          _logger.e('Error initializing video player: $e');
          if (mounted) {
            setState(() {
              _isInitialized = false;
              _hasPlayerError = true;
            });
          }
        }
      }

      if (!mounted) return;

      if (_isInitialized && !_midrollBreakActive) _videoController?.play();

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
      _comments = Comment.assembleThreadedComments(comments);
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
    _suppressAutoPipBriefly();
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
          if (mounted) {
            _showSnack("Couldn't finish downloading. Please try again.");
          }
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

  static const List<String> _quickEmojis = [
    '❤️', '🔥', '👏', '😂', '😍', '😮', '💯', '🙌', '✨', '🎉',
  ];

  void _insertEmoji(String emoji) {
    final text = _commentController.text;
    final selection = _commentController.selection;
    final start = selection.start >= 0 ? selection.start : text.length;
    final end = selection.end >= 0 ? selection.end : text.length;
    final newText = text.replaceRange(start, end, emoji);
    _commentController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: start + emoji.length),
    );
  }

  void _showCommentsBottomSheet() {
    final video = _video;
    if (video == null) return;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _WatchCommentsSheet(
        videoId: video.videoId,
        initialComments: _comments,
        onCommentAdded: (newComment) {
          if (mounted) {
            setState(() {
              final updated = [
                newComment,
                ..._comments.where((c) => c.commentId != newComment.commentId),
              ];
              _comments = Comment.assembleThreadedComments(updated);
            });
          }
        },
        onCommentDeleted: (deletedId) {
          if (mounted) {
            setState(() {
              _comments = _comments.where((c) => c.commentId != deletedId).toList();
            });
          }
        },
      ),
    );
  }

  Future<void> _postComment() async {
    final video = _video;
    final text = _commentController.text.trim();
    if (video == null || text.isEmpty || _postingComment) return;

    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      _showSnack('Sign in to comment.');
      return;
    }

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

    if (result.success && result.comment != null) {
      _commentController.clear();
      FocusScope.of(context).unfocus();
      var commentToAdd = result.comment!;
      if ((commentToAdd.userUsername == null || commentToAdd.userUsername!.isEmpty) &&
          authState.user.username.isNotEmpty) {
        commentToAdd = commentToAdd.copyWith(
          userUsername: authState.user.handle ?? authState.user.username,
        );
      }
      setState(() {
        final updated = [
          commentToAdd,
          ..._comments.where((c) => c.commentId != commentToAdd.commentId),
        ];
        _comments = Comment.assembleThreadedComments(updated);
      });
      _showSnack('Comment posted!');
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
    // Follows the finger: the page slides down, shrinks slightly and fades
    // toward the corner, so the video visibly becomes the floating window
    // rather than just vanishing when the gesture commits.
    final dragProgress =
        (_minimizeDrag / (_minimizeCommitPx * 2)).clamp(0.0, 1.0);
    final dragScale = 1.0 - (dragProgress * 0.22);
    final dragOpacity = 1.0 - (dragProgress * 0.45);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (context.canPop()) {
          context.pop();
        } else {
          context.go('/');
        }
      },
      child: PatternBackground(
        child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Transform.translate(
          offset: Offset(0, _minimizeDrag * 0.6),
          child: Transform.scale(
            scale: dragScale,
            alignment: Alignment.topCenter,
            child: Opacity(
              opacity: dragOpacity,
              child: SafeArea(
                bottom: false,
                child: Builder(
                  builder: (context) {
                    final media = MediaQuery.of(context);
                    final isTabletLandscape = media.size.shortestSide >= 600 &&
                        media.orientation == Orientation.landscape;

                    final playerWidget = AspectRatio(
                      aspectRatio: 16 / 9,
                      child: _isInitialized && _videoController != null
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
                                    onDragDown: _onPlayerDragDown,
                                    onDragDownEnd: _onPlayerDragDownEnd,
                                    initialBrightness: _playerBrightness,
                                    onBrightnessChanged: (v) =>
                                        setState(() => _playerBrightness = v),
                                  ),
                                ),
                                if (_midrollBreakActive && _currentMidrollAd != null)
                                  Positioned.fill(
                                    child: _buildMidrollOverlay(),
                                  ),
                              ],
                            )
                          : _hasPlayerError
                              ? Container(
                                  color: Colors.black,
                                  child: const Center(
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(
                                          Icons.error_outline,
                                          size: 64,
                                          color: Colors.white,
                                        ),
                                        SizedBox(height: 16),
                                        Text(
                                          'Video not available',
                                          style: TextStyle(color: Colors.white),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                              : Container(
                                  color: Colors.black,
                                  child: const Center(
                                    child: CircularProgressIndicator(
                                      color: AppColors.brandOrange,
                                    ),
                                  ),
                                ),
                    );

                    if (isTabletLandscape) {
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            flex: 62,
                            child: SingleChildScrollView(
                              padding: const EdgeInsets.fromLTRB(16, 0, 8, 20),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  playerWidget,
                                  const SizedBox(height: 16),
                                  if (_isLoading)
                                    const SizedBox.shrink()
                                  else if (_video != null)
                                    _buildPrimaryDetails(_video!)
                                  else
                                    _buildPlaceholderInfo(),
                                ],
                              ),
                            ),
                          ),
                          Expanded(
                            flex: 38,
                            child: SingleChildScrollView(
                              padding: const EdgeInsets.fromLTRB(8, 0, 16, 20),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (!_isLoading && _video != null)
                                    _buildSecondaryDetails(),
                                ],
                              ),
                            ),
                          ),
                        ],
                      );
                    }

                    return Column(
                      children: [
                        playerWidget,
                        Expanded(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 20,
                            ),
                            child: _isLoading
                                ? const SizedBox.shrink()
                                : _video != null
                                ? _buildVideoInfo(_video!)
                                : _buildPlaceholderInfo(),
                          ),
                        ),
                      ],
                    );
                  },
                  ),
                ),
              ),
            ),
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
    if (video.isStrictMusic) {
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
    // Sticky, latched once by _onPlayerTick the first time a real frame has
    // actually rendered (_firstFrameRendered) — deliberately NOT recomputed
    // live from controller.value.isPlaying on every build. This page
    // rebuilds for lots of reasons that have nothing to do with the player
    // (likes/comments/watchlist/subscription/captions each finishing their
    // own load, PiP state, brightness, quality label) — a live isPlaying
    // check flipped the video texture out of the tree and back to the bare
    // thumbnail on any of those rebuilds that happened to land mid-buffer or
    // right as playback started, which is exactly the flicker/flash being
    // reported. It also meant pausing reverted the screen to the static
    // thumbnail instead of leaving the paused frame on screen. Latching
    // fixes both: once a frame has rendered, the texture stays mounted and
    // simply stops advancing while paused, same as every other video app.
    final showVideo = _firstFrameRendered && controller.value.isInitialized;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (video.thumbnail.isNotEmpty)
          Positioned.fill(
            child: CachedNetworkImage(
              imageUrl: video.thumbnail,
              fit: BoxFit.cover,
              fadeInDuration: Duration.zero,
              fadeOutDuration: Duration.zero,
              errorWidget: (context, url, error) => const SizedBox(),
            ),
          ),
        if (showVideo)
          Positioned.fill(
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.0, end: 1.0),
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOut,
              builder: (context, opacity, child) =>
                  Opacity(opacity: opacity, child: child),
              // VideoPlayer has no intrinsic size — dropped bare into the
              // filling Stack inside the fixed 16:9 AspectRatio above it
              // gets scaled non-uniformly, so any clip that isn't exactly
              // 16:9 looks stretched. Give it its native frame size and let
              // FittedBox scale that uniformly (crop-to-fill), matching
              // short_player_widget.dart and video_card.dart.
              child: FittedBox(
                fit: BoxFit.cover,
                clipBehavior: Clip.hardEdge,
                child: SizedBox(
                  width: controller.value.size.width > 0
                      ? controller.value.size.width
                      : 1280,
                  height: controller.value.size.height > 0
                      ? controller.value.size.height
                      : 720,
                  child: VideoPlayer(controller),
                ),
              ),
            ),
          ),
      ],
    );
  }

  // The exact route _openFullscreen() pushed, so _handlePipModeChanged() can
  // remove that route (and only that route) when the OS floats the app into
  // PiP.
  Route<void>? _fullscreenRoute;

  Future<void> _openFullscreen() async {
    if (_videoController == null || _inFullscreen || _inPip) return;
    _inFullscreen = true;
    final route = MaterialPageRoute<void>(
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
          getAdOverlay: () =>
              _midrollBreakActive && _currentMidrollAd != null ? _buildMidrollOverlay() : null,
          adListenable: _adStateRevision,
        ),
    );
    _fullscreenRoute = route;
    await Navigator.of(context).push(route);
    _fullscreenRoute = null;
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
  /// How far the player has been dragged down, in logical pixels. Drives
  /// the shrink-away animation; 0 when not dragging.
  double _minimizeDrag = 0;

  /// Past this much travel (or a firm downward fling) the drag commits and
  /// the video docks into the floating window, YouTube style. Below it the
  /// page springs back.
  static const double _minimizeCommitPx = 130;
  static const double _minimizeCommitVelocity = 700;

  void _onPlayerDragDown(double distance) {
    if (!mounted) return;
    setState(() => _minimizeDrag = distance);
  }

  void _onPlayerDragDownEnd(double velocityY) {
    if (!mounted) return;
    final commit =
        _minimizeDrag >= _minimizeCommitPx || velocityY >= _minimizeCommitVelocity;
    setState(() => _minimizeDrag = 0);
    if (commit) _minimizeToMiniPlayer();
  }

  void _minimizeToMiniPlayer() {
    if (_midrollBreakActive) {
      _finishMidroll('skip');
    }
    final controller = _videoController;
    final video = _video;
    if (controller == null || video == null || !_isInitialized) return;
    // Disarm auto-PiP now: once the listener below is removed no tick can,
    // and this page stays registered until its pop transition finishes.
    // Pressing Home inside that window would otherwise float the Home screen.
    _lastPlayingForPip = false;
    PipService.setActive(this, false);
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

  Future<void> _loadMidrollConfig() async {
    try {
      final premiumService = ref.read(premiumServiceProvider);
      final status = await premiumService.getStatus();
      if (status.premium) {
        if (mounted) {
          setState(() {
            _isPremium = true;
            _midrollConfig = null;
            _currentMidrollAd = null;
          });
        }
        return;
      }

      final config = await ref.read(adServiceProvider).getMidrollConfig();
      if (!mounted) return;
      if (config != null && config.enabled && (config.ad != null || config.ads.isNotEmpty)) {
        setState(() {
          _isPremium = false;
          _midrollConfig = config;
          _currentMidrollAd = config.ad ?? (config.ads.isNotEmpty ? config.ads.first : null);
        });
        _preloadAdVideo(_currentMidrollAd);
        _maybeTriggerPreroll();
      }
    } catch (e) {
      _logger.w('WatchPage: Failed to load ad config: $e');
    }
  }

  void _maybeTriggerPreroll() {
    if (_prerollShown || _isPremium || _midrollBreakActive) return;
    final config = _midrollConfig;
    final ad = _currentMidrollAd;
    final controller = _videoController;
    if (config == null || !config.enabled || ad == null || controller == null || !_isInitialized) {
      return;
    }

    _prerollShown = true;
    _triggerAdBreak('preroll', triggerKey: 0);
  }

  void _checkPostrollOnPlayerTick() {
    if (_postrollShown || _isPremium || _midrollBreakActive) return;
    final config = _midrollConfig;
    final ad = _currentMidrollAd;
    final controller = _videoController;
    if (config == null || !config.enabled || ad == null || controller == null || !_isInitialized) {
      return;
    }

    final pos = controller.value.position;
    final dur = controller.value.duration;
    if (dur > Duration.zero && pos >= dur) {
      _postrollShown = true;
      _triggerAdBreak('postroll', triggerKey: 9999);
    }
  }

  void _handleMidrollTimeUpdate() {
    final controller = _videoController;
    final config = _midrollConfig;
    if (controller == null ||
        config == null ||
        !config.enabled ||
        _isPremium ||
        _midrollBreakActive ||
        !_isInitialized ||
        !controller.value.isInitialized) {
      return;
    }

    // Do not trigger mid-roll before pre-roll is resolved
    if (!_prerollShown && controller.value.position.inSeconds < 2) return;

    final currentAd = _currentMidrollAd ?? (config.ads.isNotEmpty ? config.ads.first : config.ad);
    if (currentAd == null) return;

    final currentTime = controller.value.position.inSeconds;
    final duration = controller.value.duration.inSeconds;

    // Never trigger in the final 5 seconds before the video ends
    if (duration > 0 && (duration - currentTime) < 5) return;

    bool shouldTrigger = false;
    int triggerKey = 1;

    // For videos shorter than 1.5x the configured interval, place a mid-roll break
    // at the video's midpoint (at least 15s into playback)
    if (duration > 0 && duration < (config.intervalSeconds * 1.5).round()) {
      final midPoint = (duration ~/ 2).clamp(15, duration);
      if (currentTime >= midPoint && !_midrollBreaksShown.contains(1)) {
        shouldTrigger = true;
        triggerKey = 1;
      }
    } else {
      // Standard multiple-interval calculation
      final breakIndex = currentTime ~/ config.intervalSeconds;
      if (breakIndex >= 1 && !_midrollBreaksShown.contains(breakIndex)) {
        shouldTrigger = true;
        triggerKey = breakIndex;
      }
    }

    if (!shouldTrigger) return;

    _triggerAdBreak('midroll', triggerKey: triggerKey);
  }

  void _triggerAdBreak(String breakType, {int triggerKey = 1}) {
    final controller = _videoController;
    final config = _midrollConfig;
    if (controller == null || config == null || _isPremium) return;

    _adBreakType = breakType;
    if (breakType == 'midroll') {
      _midrollBreaksShown.add(triggerKey);
    }
    _midrollWasPlaying = controller.value.isPlaying || _midrollWasPlaying;
    controller.pause();

    // Rotate creative if multiple ads
    if (config.ads.length > 1) {
      final nextIndex =
          (_midrollBreaksShown.length + (breakType == 'postroll' ? 1 : 0)) % config.ads.length;
      _currentMidrollAd = config.ads[nextIndex];
    } else {
      _currentMidrollAd = config.ad ?? (config.ads.isNotEmpty ? config.ads.first : null);
    }

    final ad = _currentMidrollAd;
    if (ad == null) return;

    final tierIndex = (_midrollBreaksShown.length - 1).clamp(0, config.skipTiersSeconds.length - 1);
    _midrollCountdown = config.skipTiersSeconds.isNotEmpty ? config.skipTiersSeconds[tierIndex] : 5;
    _midrollSkipUnlocked = false;
    _midrollBreakActive = true;
    _adStateRevision.value++;

    // Track impression when ad starts playback
    ref.read(adServiceProvider).trackMidrollEvent(ad.adId, kind: 'impression');

    _startMidrollTimer();
    _initAdVideoIfNeeded();

    if (mounted) setState(() {});
  }

  void _startMidrollTimer() {
    _midrollTimer?.cancel();
    _midrollTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || !_midrollBreakActive) {
        timer.cancel();
        return;
      }
      if (_midrollCountdown > 1) {
        setState(() {
          _midrollCountdown--;
        });
        _adStateRevision.value++;
      } else {
        timer.cancel();
        setState(() {
          _midrollCountdown = 0;
          _midrollSkipUnlocked = true;
        });
        _adStateRevision.value++;
      }
    });
  }

  // Pre-warm a Mux ad video so the break doesn't pay the full network +
  // HLS cold-start cost on the critical path. Fire-and-forget: any failure
  // just falls back to the on-demand init in _initAdVideoIfNeeded.
  Future<void> _preloadAdVideo(MidrollAd? ad) async {
    if (ad == null || !ad.imageUrl.startsWith('mux:')) return;
    if (_preloadedAdKey == ad.imageUrl && _preloadedAdController != null) return;
    final prev = _preloadedAdController;
    _preloadedAdController = null;
    _preloadedAdKey = null;
    prev?.dispose();
    final playbackId = ad.imageUrl.replaceFirst('mux:', '');
    final streamUrl = 'https://stream.mux.com/$playbackId.m3u8';
    try {
      final ctrl = VideoPlayerController.networkUrl(Uri.parse(streamUrl));
      await ctrl.initialize();
      if (!mounted) {
        await ctrl.dispose();
        return;
      }
      _preloadedAdController = ctrl;
      _preloadedAdKey = ad.imageUrl;
    } catch (e) {
      _logger.w('WatchPage: Failed to preload ad video: $e');
    }
  }

  Future<void> _initAdVideoIfNeeded() async {
    final ad = _currentMidrollAd;
    if (ad == null) return;

    if (ad.imageUrl.startsWith('mux:')) {
      // Reuse a pre-warmed controller for the exact same creative if one is
      // ready — this is what removes the cold-start stall on mid-roll breaks.
      if (_preloadedAdKey == ad.imageUrl && _preloadedAdController != null) {
        final ctrl = _preloadedAdController!;
        _preloadedAdController = null;
        _preloadedAdKey = null;
        if (!mounted || !_midrollBreakActive) {
          await ctrl.dispose();
          return;
        }
        _adVideoController = ctrl;
        await ctrl.setVolume(1.0);
        ctrl.addListener(_onAdVideoTick);
        await ctrl.play();
        _adStateRevision.value++;
        if (mounted) setState(() {});
        return;
      }
      final playbackId = ad.imageUrl.replaceFirst('mux:', '');
      final streamUrl = 'https://stream.mux.com/$playbackId.m3u8';
      try {
        final ctrl = VideoPlayerController.networkUrl(Uri.parse(streamUrl));
        _adVideoController = ctrl;
        await ctrl.initialize();
        if (!mounted || !_midrollBreakActive) {
          await ctrl.dispose();
          return;
        }
        await ctrl.setVolume(1.0);
        ctrl.addListener(_onAdVideoTick);
        await ctrl.play();
        _adStateRevision.value++;
        if (mounted) setState(() {});
      } catch (e) {
        _logger.w('WatchPage: Failed to initialize ad video: $e');
        if (mounted) {
          setState(() {
            _midrollSkipUnlocked = true;
          });
          _adStateRevision.value++;
        }
      }
    }
  }

  void _onAdVideoTick() {
    final ctrl = _adVideoController;
    if (ctrl == null || !ctrl.value.isInitialized) return;
    if (ctrl.value.position >= ctrl.value.duration && ctrl.value.duration > Duration.zero) {
      _finishMidroll('ended');
    }
  }

  void _finishMidroll(String reason) {
    if (!_midrollBreakActive && reason != 'reset') return;
    _midrollTimer?.cancel();

    if (_currentMidrollAd != null && (reason == 'skip' || reason == 'ended')) {
      ref.read(adServiceProvider).trackMidrollEvent(_currentMidrollAd!.adId, kind: 'skip');
    }

    final adCtrl = _adVideoController;
    _adVideoController = null;
    if (adCtrl != null) {
      adCtrl.removeListener(_onAdVideoTick);
      try {
        adCtrl.pause();
      } catch (_) {}
      adCtrl.dispose();
    }

    final finishedBreakType = _adBreakType;
    _midrollBreakActive = false;
    if (finishedBreakType == 'preroll') {
      _prerollShown = true;
    } else if (finishedBreakType == 'postroll') {
      _postrollShown = true;
    }
    _adStateRevision.value++;

    if (mounted) setState(() {});

    final controller = _videoController;
    if (controller != null && reason != 'reset' && finishedBreakType != 'postroll') {
      if (controller.value.isInitialized) {
        controller.play().catchError((err) {
          _logger.w('WatchPage: resume main video error: $err');
        });
      } else {
        controller.initialize().then((_) {
          if (mounted && !_midrollBreakActive) {
            controller.play().catchError((err) {
              _logger.w('WatchPage: resume main video error: $err');
            });
          }
        }).catchError((err) {
          _logger.w('WatchPage: initialize on resume error: $err');
        });
      }
    }
  }

  Widget _buildMidrollOverlay() {
    final ad = _currentMidrollAd;
    if (ad == null || !_midrollBreakActive) return const SizedBox();

    return Container(
      color: Colors.black,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (_adVideoController != null && _adVideoController!.value.isInitialized)
            Center(
              child: AspectRatio(
                aspectRatio: _adVideoController!.value.aspectRatio > 0
                    ? _adVideoController!.value.aspectRatio
                    : (16 / 9),
                child: VideoPlayer(_adVideoController!),
              ),
            )
          else if (smartImageProvider(ad.imageUrl) != null)
            Image(
              image: smartImageProvider(ad.imageUrl)!,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => Container(
                color: Colors.black45,
                child: const Center(
                  child: Icon(Icons.campaign, color: Colors.white54, size: 40),
                ),
              ),
            )
          else
            Container(
              color: Colors.black45,
              child: const Center(
                child: Icon(Icons.campaign, color: Colors.white54, size: 40),
              ),
            ),

          // Top-Left: Badge + Title inside ad viewport
          Positioned(
            top: 12,
            left: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.amber.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.amber.withValues(alpha: 0.5)),
                    ),
                    child: Text(
                      _adBreakType == 'preroll'
                          ? 'Ad'
                          : _adBreakType == 'postroll'
                              ? 'Post-Roll Ad'
                              : 'Sponsored Break',
                      style: const TextStyle(
                        color: Colors.amber,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  if (ad.title.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 160),
                      child: Text(
                        ad.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Bottom-Left: Skip Countdown Button (exact same baseline as Visit Sponsor)
          Positioned(
            bottom: 12,
            left: 12,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _midrollSkipUnlocked ? () => _finishMidroll('skip') : null,
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: _midrollSkipUnlocked
                        ? Colors.white
                        : Colors.black.withValues(alpha: 0.85),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _midrollSkipUnlocked
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.5),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.5),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_midrollSkipUnlocked) ...[
                        const Text(
                          'Skip Ad',
                          style: TextStyle(
                            color: Colors.black,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.skip_next, size: 16, color: Colors.black),
                      ] else ...[
                        const Icon(Icons.timer_outlined, size: 14, color: Colors.amber),
                        const SizedBox(width: 6),
                        Text(
                          'Skip in ${_midrollCountdown}s',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),

          // Bottom-Right: Visit Sponsor Button (exact same baseline as Skip Button)
          Positioned(
            bottom: 12,
            right: 12,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () async {
                  ref.read(adServiceProvider).trackMidrollEvent(ad.adId, kind: 'click');
                  final targetUrl = ad.linkUrl.trim().isNotEmpty
                      ? ad.linkUrl.trim()
                      : 'https://inplayer.in';
                  final uri = Uri.tryParse(targetUrl);
                  if (uri != null) {
                    _suppressAutoPipBriefly();
                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                  }
                },
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.85),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Colors.amber.withValues(alpha: 0.8),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.5),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Visit Sponsor',
                        style: TextStyle(
                          color: Colors.amber,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      SizedBox(width: 6),
                      Icon(Icons.open_in_new, size: 14, color: Colors.amber),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrimaryDetails(Video video) {
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
      ],
    );
  }

  Widget _buildSecondaryDetails() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildCommentsSection(),
        const SizedBox(height: 24),
        _buildAdBanner(),
        const SizedBox(height: 24),
        _buildRecommendedVideos(),
      ],
    );
  }

  Widget _buildVideoInfo(Video video) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildPrimaryDetails(video),
        const SizedBox(height: 24),
        _buildSecondaryDetails(),
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
    if (_video?.commentsEnabled == false) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: context.isDark
              ? Colors.white.withValues(alpha: 0.04)
              : Colors.black.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: context.borderSubtle),
        ),
        child: Row(
          children: [
            Icon(
              Icons.comments_disabled_outlined,
              size: 20,
              color: context.textDim,
            ),
            const SizedBox(width: 10),
            Text(
              'Comments are turned off for this video.',
              style: TextStyle(
                color: context.textSecondary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    }

    final authState = ref.watch(authStateProvider);
    final currentUser =
        authState is AuthStateAuthenticated ? authState.user : null;
    final isSignedIn = currentUser != null;
    final visibleComments =
        _commentsExpanded ? _comments : _comments.take(3).toList();
    final totalCount = _comments.isNotEmpty
        ? _comments.length
        : (_video?.commentCount ?? 0);

    return Container(
      width: double.infinity,
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
          // Header Row: Comments count + View all sheet launcher
          Row(
            children: [
              Text(
                'Comments',
                style: TextStyle(
                  color: context.textPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
              if (totalCount > 0) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.brandOrange.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$totalCount',
                    style: const TextStyle(
                      color: AppColors.brandOrange,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
              const Spacer(),
              if (_comments.isNotEmpty)
                GestureDetector(
                  onTap: _showCommentsBottomSheet,
                  child: Row(
                    children: [
                      Text(
                        'View all',
                        style: TextStyle(
                          color: AppColors.brandOrange,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 2),
                      const Icon(
                        Icons.chevron_right,
                        size: 16,
                        color: AppColors.brandOrange,
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),

          // Real comment(s) displayed directly below the header
          if (_commentsLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 14),
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
          else if (_comments.isNotEmpty) ...[
            ...visibleComments.map(_buildCommentTile),
            if (!_commentsExpanded && _comments.length > 3)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: GestureDetector(
                  onTap: () => setState(() => _commentsExpanded = true),
                  child: Text(
                    'Show all ${_comments.length} comments',
                    style: const TextStyle(
                      color: AppColors.brandOrange,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 16),
            Divider(color: context.borderSubtle, height: 1),
            const SizedBox(height: 14),
          ] else
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'No comments yet. Be the first to say something.',
                style: TextStyle(color: context.textSecondary, fontSize: 13),
              ),
            ),

          // Comment Composer
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              UserAvatar(
                avatarUrl: currentUser?.avatarUrl,
                name: currentUser?.displayName ?? 'User',
                size: 32,
              ),
              const SizedBox(width: 10),
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
                              ? 'Add a comment...'
                              : 'Sign in to comment...',
                          hintStyle: TextStyle(
                            color: context.textDim,
                            fontSize: 13,
                          ),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Quick Emoji Bar + Working Post Button
                    Row(
                      children: [
                        Expanded(
                          child: SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                for (final emoji in _quickEmojis)
                                  Padding(
                                    padding: const EdgeInsets.only(right: 6),
                                    child: InkWell(
                                      onTap: () => _insertEmoji(emoji),
                                      borderRadius: BorderRadius.circular(8),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 6,
                                          vertical: 3,
                                        ),
                                        decoration: BoxDecoration(
                                          color: context.isDark
                                              ? Colors.white.withValues(alpha: 0.06)
                                              : Colors.black.withValues(alpha: 0.04),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          emoji,
                                          style: const TextStyle(fontSize: 15),
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ValueListenableBuilder<TextEditingValue>(
                          valueListenable: _commentController,
                          builder: (context, value, _) {
                            final hasText = value.text.trim().isNotEmpty;
                            return GestureDetector(
                              onTap: hasText && !_postingComment
                                  ? _postComment
                                  : (isSignedIn
                                      ? null
                                      : () => _showSnack(
                                            'Please sign in to comment.',
                                          )),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  gradient: hasText && !_postingComment
                                      ? AppColors.flameGradient
                                      : null,
                                  color: hasText && !_postingComment
                                      ? null
                                      : (context.isDark
                                          ? Colors.white.withValues(alpha: 0.1)
                                          : Colors.black.withValues(alpha: 0.08)),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: _postingComment
                                    ? const SizedBox(
                                        width: 14,
                                        height: 14,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          valueColor: AlwaysStoppedAnimation(
                                            Colors.white,
                                          ),
                                        ),
                                      )
                                    : Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(
                                            'Post',
                                            style: TextStyle(
                                              color: hasText
                                                  ? Colors.white
                                                  : context.textDim,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                          Icon(
                                            Icons.arrow_upward_rounded,
                                            size: 14,
                                            color: hasText
                                                ? Colors.white
                                                : context.textDim,
                                          ),
                                        ],
                                      ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCommentTile(Comment comment) {
    return CommentThreadTile(
      key: ValueKey(comment.commentId),
      comment: comment,
      videoId: widget.videoId,
      onCommentDeleted: (deletedId) {
        setState(() {
          _comments = _comments.where((c) => c.commentId != deletedId).toList();
        });
      },
      onReplyAdded: (newReply) {
        setState(() {
          final updated = [
            newReply,
            ..._comments.where((c) => c.commentId != newReply.commentId),
          ];
          _comments = Comment.assembleThreadedComments(updated);
        });
      },
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

class _WatchCommentsSheet extends ConsumerStatefulWidget {
  final String videoId;
  final List<Comment> initialComments;
  final ValueChanged<Comment> onCommentAdded;
  final ValueChanged<String>? onCommentDeleted;

  const _WatchCommentsSheet({
    required this.videoId,
    required this.initialComments,
    required this.onCommentAdded,
    this.onCommentDeleted,
  });

  @override
  ConsumerState<_WatchCommentsSheet> createState() =>
      _WatchCommentsSheetState();
}

class _WatchCommentsSheetState extends ConsumerState<_WatchCommentsSheet> {
  late List<Comment> _comments;
  final _commentCtrl = TextEditingController();
  bool _loading = false;
  bool _posting = false;

  static const List<String> _sheetEmojis = [
    '❤️', '🔥', '👏', '😂', '😍', '😮', '💯', '🙌', '✨', '🎉',
  ];

  @override
  void initState() {
    super.initState();
    _comments = Comment.assembleThreadedComments(widget.initialComments);
    if (_comments.isEmpty) {
      _fetchComments();
    }
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchComments() async {
    setState(() => _loading = true);
    try {
      final list =
          await ref.read(commentServiceProvider).getComments(widget.videoId);
      if (mounted) {
        setState(() {
          _comments = Comment.assembleThreadedComments(list);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _insertEmoji(String emoji) {
    final text = _commentCtrl.text;
    final selection = _commentCtrl.selection;
    final start = selection.start >= 0 ? selection.start : text.length;
    final end = selection.end >= 0 ? selection.end : text.length;
    final newText = text.replaceRange(start, end, emoji);
    _commentCtrl.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: start + emoji.length),
    );
  }

  Future<void> _postComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty || _posting) return;

    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please sign in to comment.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
      return;
    }

    setState(() => _posting = true);
    final service = ref.read(commentServiceProvider);
    final res = await service.postComment(widget.videoId, text);

    if (mounted) {
      setState(() => _posting = false);
      if (res.requiresSignIn) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please sign in to comment.'),
            backgroundColor: AppColors.surfaceDark,
          ),
        );
        return;
      }
      if (res.flagged) {
        _commentCtrl.clear();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Your comment was submitted for review.'),
            backgroundColor: AppColors.surfaceDark,
          ),
        );
        return;
      }
      if (res.comment != null) {
        _commentCtrl.clear();
        FocusScope.of(context).unfocus();
        var commentToAdd = res.comment!;
        final auth = ref.read(authStateProvider);
        if ((commentToAdd.userUsername == null || commentToAdd.userUsername!.isEmpty) &&
            auth is AuthStateAuthenticated &&
            auth.user.username.isNotEmpty) {
          commentToAdd = commentToAdd.copyWith(
            userUsername: auth.user.handle ?? auth.user.username,
          );
        }
        setState(() {
          final updated = [
            commentToAdd,
            ..._comments.where((c) => c.commentId != commentToAdd.commentId),
          ];
          _comments = Comment.assembleThreadedComments(updated);
        });
        widget.onCommentAdded(commentToAdd);
      } else if (res.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res.error!),
            backgroundColor: AppColors.surfaceDark,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final currentUser =
        authState is AuthStateAuthenticated ? authState.user : null;
    final isSignedIn = currentUser != null;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Container(
          height: MediaQuery.of(context).size.height * 0.70,
          decoration: BoxDecoration(
            color: context.isDark ? AppColors.drawerDark : AppColors.surfaceLight,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: context.borderSubtle),
          ),
      child: Column(
        children: [
          // Drag Handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            width: 38,
            height: 4,
            decoration: BoxDecoration(
              color: context.textDim.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(
                      'Comments',
                      style: TextStyle(
                        color: context.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    if (_comments.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.brandOrange.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '${_comments.length}',
                          style: const TextStyle(
                            color: AppColors.brandOrange,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                IconButton(
                  icon: Icon(
                    Icons.close,
                    color: context.textSecondary,
                    size: 20,
                  ),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          Divider(color: context.borderSubtle, height: 1),

          // Comments List
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                      color: AppColors.brandOrange,
                    ),
                  )
                : _comments.isEmpty
                ? Center(
                    child: Text(
                      'No comments yet. Be the first to comment!',
                      style: TextStyle(color: context.textSecondary),
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
                      return CommentThreadTile(
                        key: ValueKey(c.commentId),
                        comment: c,
                        videoId: widget.videoId,
                        onProfileNavigated: () {
                          Navigator.of(context).pop();
                        },
                        onCommentDeleted: (deletedId) {
                          setState(() {
                            _comments = _comments.where((x) => x.commentId != deletedId).toList();
                          });
                          widget.onCommentDeleted?.call(deletedId);
                        },
                        onReplyAdded: (newReply) {
                          setState(() {
                            final updated = [
                              newReply,
                              ..._comments.where((x) => x.commentId != newReply.commentId),
                            ];
                            _comments = Comment.assembleThreadedComments(updated);
                          });
                          widget.onCommentAdded(newReply);
                        },
                      );
                    },
                  ),
          ),

          // Composer Bar at Bottom
          Container(
            padding: EdgeInsets.fromLTRB(
              16,
              8,
              16,
              MediaQuery.of(context).viewInsets.bottom + 12,
            ),
            decoration: BoxDecoration(
              color: context.isDark
                  ? Colors.black.withValues(alpha: 0.5)
                  : Colors.white,
              border: Border(top: BorderSide(color: context.borderSubtle)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    UserAvatar(
                      avatarUrl: currentUser?.avatarUrl,
                      name: currentUser?.displayName ?? 'User',
                      size: 28,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _commentCtrl,
                        style: TextStyle(
                          color: context.textPrimary,
                          fontSize: 13,
                        ),
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _postComment(),
                        decoration: InputDecoration(
                          hintText: isSignedIn
                              ? 'Add a comment...'
                              : 'Sign in to comment...',
                          hintStyle: TextStyle(
                            color: context.textDim,
                            fontSize: 13,
                          ),
                          filled: true,
                          fillColor: context.isDark
                              ? Colors.white.withValues(alpha: 0.08)
                              : Colors.black.withValues(alpha: 0.04),
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
                    ValueListenableBuilder<TextEditingValue>(
                      valueListenable: _commentCtrl,
                      builder: (context, value, _) {
                        final hasText = value.text.trim().isNotEmpty;
                        return GestureDetector(
                          onTap: hasText && !_posting ? _postComment : null,
                          child: Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: hasText ? AppColors.flameGradient : null,
                              color: hasText
                                  ? null
                                  : (context.isDark
                                      ? Colors.white12
                                      : Colors.black12),
                            ),
                            alignment: Alignment.center,
                            child: _posting
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor:
                                          AlwaysStoppedAnimation(Colors.white),
                                    ),
                                  )
                                : Icon(
                                    Icons.arrow_upward_rounded,
                                    color: hasText
                                        ? Colors.white
                                        : context.textDim,
                                    size: 16,
                                  ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                // Sheet Quick Emojis
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final emoji in _sheetEmojis)
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: InkWell(
                            onTap: () => _insertEmoji(emoji),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: context.isDark
                                    ? Colors.white.withValues(alpha: 0.06)
                                    : Colors.black.withValues(alpha: 0.04),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                emoji,
                                style: const TextStyle(fontSize: 15),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  ),
);
}
}
