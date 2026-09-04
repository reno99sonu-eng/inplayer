import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ivs_broadcast/ivs_broadcast.dart';
import 'package:logger/logger.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:video_player/video_player.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../services/ai_assist_service.dart';
import '../../../../services/live_service.dart';
import '../../../../models/live_stream.dart';
import '../../../../services/video_service.dart';
import '../../../upload/presentation/widgets/ai_title_assist_sheet.dart';

const _visibilityOptions = [
  (value: 'public', label: 'Public — anyone can watch'),
  (value: 'unlisted', label: 'Unlisted — only people with the link'),
  (value: 'private', label: 'Private — only you'),
];

/// setup   → filling in the stream's details
/// starting→ creating the IVS channel and opening the camera
/// live    → broadcasting from this phone (native path)
/// encoder → Android 8 or older: stream key for an external encoder
/// ended   → done
enum _Stage { setup, starting, live, encoder, ended }

/// The app's counterpart to the website's `app/live/page.tsx`.
///
/// The website does not hand out a stream key and tell you to go find OBS —
/// it broadcasts straight from the browser with `amazon-ivs-web-broadcast`,
/// and this screen now does the same thing from the phone's own camera and
/// microphone through AWS's native Amazon IVS Broadcast SDK for Android
/// (packages/ivs_broadcast). Same IVS channel, same credentials from
/// `POST /api/live/ivs-create`; nothing on the backend moved for it.
///
/// The one place the two surfaces deliberately diverge is Android 8 and
/// older, which the IVS broadcast SDK does not support at all. Rather than
/// hide Go Live from those phones, they keep the stream-key flow this screen
/// used to show for everyone.
class GoLivePage extends ConsumerStatefulWidget {
  const GoLivePage({super.key});

  @override
  ConsumerState<GoLivePage> createState() => _GoLivePageState();
}

class _GoLivePageState extends ConsumerState<GoLivePage>
    with WidgetsBindingObserver {
  /// Mirrors the website's `CAMERA_START_TIMEOUT_MS`. See [_armCameraWatchdog].
  static const Duration _cameraStartTimeout = Duration(minutes: 5);

  /// Survives the process so a stream that was still marked live when the app
  /// was killed can be found and ended on the next visit. See
  /// [_buildStrandedBanner].
  static const String _prefsStrandedId = 'live.activeVideoId';
  static const String _prefsStrandedTitle = 'live.activeTitle';

  final _logger = Logger();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();

  late final LiveService _liveService;

  _Stage _stage = _Stage.setup;
  String _visibility = 'public';
  bool _commentsEnabled = true;
  bool _showStreamKey = false;
  String? _error;
  String? _cameraTimeoutNotice;

  bool _checkingSupport = true;
  bool _nativeSupported = false;

  LiveCreateResult? _creds;

  StreamSubscription<IvsBroadcastEvent>? _events;
  IvsBroadcastState _broadcastState = IvsBroadcastState.invalid;
  bool _onAir = false;

  /// When this broadcast actually reached IVS, used for the elapsed timer.
  /// Set from the connected event rather than from when Start was tapped,
  /// so the clock measures time genuinely on air.
  DateTime? _onAirSince;
  Timer? _airTimer;

  /// Live viewer count, or null while it is not knowable — see
  /// LiveService.getViewerCount.
  int? _viewerCount;
  Timer? _viewerPollTimer;
  bool _micMuted = false;
  bool _cameraOn = true;
  bool _frontCamera = true;
  bool _switchingCamera = false;
  bool _ending = false;
  Timer? _cameraWatchdog;

  /// null while the native side is still climbing its preview fallback
  /// ladder; false once every rendering path has failed on this phone.
  bool? _previewReady;

  /// Camera positions this handset actually has, e.g. {FRONT, BACK}. One
  /// entry means there is nothing to flip to, so no flip button is offered.
  Set<String> _cameraPositions = const <String>{};

  /// Set when another app steals the camera or mic mid-broadcast.
  String? _deviceLostNotice;

  String? _strandedVideoId;
  String? _strandedTitle;
  bool _clearingStranded = false;

  // Encoder-path preview only (the native path previews the real camera).
  VideoPlayerController? _previewController;
  bool _previewLoading = false;
  bool _previewFailed = false;

  bool get _broadcasting => _stage == _Stage.live;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Read once, here, so [dispose] never has to touch a provider while the
    // element is being torn down.
    _liveService = ref.read(liveServiceProvider);
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final supported = await IvsBroadcast.isSupported();
    String? strandedId;
    String? strandedTitle;
    try {
      final prefs = await SharedPreferences.getInstance();
      strandedId = prefs.getString(_prefsStrandedId);
      strandedTitle = prefs.getString(_prefsStrandedTitle);
    } catch (e) {
      _logger.w('Could not read stranded live stream: $e');
    }
    if (!mounted) return;
    setState(() {
      _nativeSupported = supported;
      _checkingSupport = false;
      _strandedVideoId = strandedId;
      _strandedTitle = strandedTitle;
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cameraWatchdog?.cancel();
    _stopAirTimers();
    _events?.cancel();
    // Last-resort backstop. PopScope below normally handles leaving properly,
    // but if this screen goes away by any other route the camera and mic must
    // still be released — a broadcast nobody is watching over a camera nobody
    // knows is on is the worst possible failure here.
    if (_broadcasting) {
      final videoId = _creds?.videoId;
      unawaited(IvsBroadcast.stop());
      if (videoId != null) {
        unawaited(_liveService.endLive(videoId).then((_) => _forgetStranded()));
      }
    }
    _titleController.dispose();
    _descriptionController.dispose();
    _previewController?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_broadcasting) return;
    if (state == AppLifecycleState.detached) {
      unawaited(IvsBroadcast.stop());
      return;
    }
    if (state == AppLifecycleState.resumed && mounted) {
      // Android can tear a preview's underlying surface down while the app is
      // in the background, and a view that comes back attached but dead looks
      // exactly like a broken camera. Rebuild rather than trust it survived.
      setState(() => _previewReady = null);
      unawaited(IvsBroadcast.refreshPreview());
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: context.isDark
            ? AppColors.surfaceDark
            : AppColors.surfaceLight,
      ),
    );
  }

  // ── stranded-stream bookkeeping ────────────────────────────────────────

  Future<void> _rememberStranded(String videoId, String title) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsStrandedId, videoId);
      await prefs.setString(_prefsStrandedTitle, title);
    } catch (e) {
      _logger.w('Could not record the active live stream: $e');
    }
  }

  Future<void> _forgetStranded() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_prefsStrandedId);
      await prefs.remove(_prefsStrandedTitle);
    } catch (e) {
      _logger.w('Could not clear the active live stream: $e');
    }
  }

  Future<void> _endStranded() async {
    final videoId = _strandedVideoId;
    if (videoId == null || _clearingStranded) return;
    setState(() => _clearingStranded = true);
    final ok = await _liveService.endLive(videoId);
    await _forgetStranded();
    if (!mounted) return;
    setState(() {
      _clearingStranded = false;
      _strandedVideoId = null;
      _strandedTitle = null;
    });
    if (ok) {
      VideoService.clearAudienceCaches();
      _showSnack('That stream is no longer marked live.');
    } else {
      _showSnack("Couldn't end it. Try again in a moment.");
    }
  }

  // ── permissions ────────────────────────────────────────────────────────

  Future<bool> _ensurePermissions() async {
    final statuses = await [Permission.camera, Permission.microphone].request();
    final camera = statuses[Permission.camera] ?? PermissionStatus.denied;
    final mic = statuses[Permission.microphone] ?? PermissionStatus.denied;
    if (camera.isGranted && mic.isGranted) return true;

    if (!mounted) return false;
    final permanentlyDenied =
        camera.isPermanentlyDenied || mic.isPermanentlyDenied;
    setState(() {
      _error = permanentlyDenied
          ? 'Camera and microphone access are turned off for InPlayer. Turn them on in Settings to go live.'
          : 'InPlayer needs your camera and microphone to broadcast.';
    });
    if (permanentlyDenied) {
      final open = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: context.bgModal,
          title: Text(
            'Allow camera & microphone',
            style: TextStyle(
              color: context.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          content: Text(
            'Going live broadcasts your camera and microphone. Both are '
            'currently blocked for InPlayer.',
            style: TextStyle(color: context.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Not now'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Open Settings'),
            ),
          ],
        ),
      );
      if (open == true) await openAppSettings();
    }
    return false;
  }

  // ── going live ─────────────────────────────────────────────────────────

  Future<void> _goLive() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Please give your live stream a title.');
      return;
    }

    // They're trying again — clear any previous "camera switched off" notice,
    // exactly like the website does.
    setState(() {
      _error = null;
      _cameraTimeoutNotice = null;
    });

    if (_nativeSupported && !await _ensurePermissions()) return;
    if (!mounted) return;

    setState(() => _stage = _Stage.starting);

    final result = await _liveService.goLive(
      title: title,
      description: _descriptionController.text.trim(),
      visibility: _visibility,
      commentsEnabled: _commentsEnabled,
    );

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _stage = _Stage.setup;
        _error = result.error ?? "Couldn't start a live stream.";
      });
      return;
    }

    // A newly-created live record is immediately visible to the website and
    // admin content browser. Drop the app's short-lived feed cache so the
    // creator's channel and home feed do not wait for its TTL.
    VideoService.clearAudienceCaches();

    final videoId = result.videoId;
    if (videoId != null) unawaited(_rememberStranded(videoId, title));

    final endpoint = result.ingestEndpoint;
    final streamKey = result.streamKey;

    if (!_nativeSupported || endpoint == null || streamKey == null) {
      setState(() {
        _creds = result;
        _stage = _Stage.encoder;
      });
      return;
    }

    setState(() {
      _creds = result;
      _stage = _Stage.live;
      _onAir = false;
      _onAirSince = null;
      _viewerCount = null;
      _micMuted = false;
      _cameraOn = true;
      _frontCamera = true;
      _previewReady = null;
      _cameraPositions = const <String>{};
      _deviceLostNotice = null;
      _broadcastState = IvsBroadcastState.connecting;
    });

    _listenToBroadcast();

    try {
      await IvsBroadcast.start(
        ingestEndpoint: endpoint,
        streamKey: streamKey,
        frontCamera: true,
      );
    } catch (e) {
      _logger.e('Failed to start native broadcast: $e');
      await _abandonBroadcast(
        "Couldn't start broadcasting. Check your camera permissions and try again.",
      );
      return;
    }

    // The camera is genuinely open now — arm the watchdog.
    _armCameraWatchdog();
  }

  void _listenToBroadcast() {
    _events?.cancel();
    _events = IvsBroadcast.events.listen((event) {
      if (!mounted) return;
      switch (event) {
        case IvsStateEvent(:final state):
          setState(() => _broadcastState = state);
          if (state == IvsBroadcastState.connected) {
            // Genuinely live — stand the watchdog down before it can ever
            // fire against a healthy broadcast.
            _cameraWatchdog?.cancel();
            _cameraWatchdog = null;
            setState(() {
              _onAir = true;
              _onAirSince ??= DateTime.now();
              _error = null;
            });
            _startAirTimers();
          }
        case IvsPreviewEvent(:final ready):
          setState(() => _previewReady = ready);
        case IvsCamerasEvent(:final positions, :final front):
          setState(() {
            _cameraPositions = positions;
            _frontCamera = front;
          });
        case IvsDeviceLostEvent(:final kind):
          setState(() {
            _deviceLostNotice = kind == 'microphone'
                ? 'Another app took the microphone — your viewers may not be '
                      'able to hear you.'
                : 'Another app took the camera — your viewers may not be able '
                      'to see you.';
          });
        case IvsErrorEvent(:final detail, :final fatal, :final source):
          _logger.w('IVS broadcast error [$source]: $detail');
          if (fatal) {
            unawaited(
              _abandonBroadcast(
                'The broadcast stopped unexpectedly. Please try going live again.',
              ),
            );
          } else {
            setState(() => _error = 'Connection is struggling — still trying.');
          }
      }
    });
  }

  /// The website's camera watchdog, ported.
  ///
  /// [IvsBroadcast.start] opens the camera and microphone several steps
  /// before the broadcast actually goes live. If any step in between never
  /// completes — most realistically the connection to IVS hanging rather
  /// than failing outright — the camera stays on indefinitely with nothing
  /// being streamed: the indicator stays lit, the mic stays open, and the
  /// person may well have put the phone down assuming nothing is running.
  /// An outright error is already handled; a hang is not, because something
  /// that never finishes never reaches either branch.
  ///
  /// So: armed the moment the camera is acquired, cancelled the moment the
  /// session reports CONNECTED. If five minutes pass with the camera live
  /// and the stream still not started, it shuts the camera and mic off and
  /// says so on screen rather than leaving hardware running silently.
  void _armCameraWatchdog() {
    _cameraWatchdog?.cancel();
    _cameraWatchdog = Timer(_cameraStartTimeout, () {
      if (!mounted || _onAir) return;
      unawaited(
        _abandonBroadcast(
          null,
          notice:
              'Your camera and microphone were switched off automatically '
              "because the live stream didn't start within 5 minutes. Nothing "
              'was broadcast. You can try going live again whenever '
              "you're ready.",
        ),
      );
    });
  }

  /// Tears everything down and returns to the setup form: stops the native
  /// session, releases the camera, and marks the stream ended server-side so
  /// it stops showing as live to everyone else.
  Future<void> _abandonBroadcast(String? error, {String? notice}) async {
    _cameraWatchdog?.cancel();
    _cameraWatchdog = null;
    await _events?.cancel();
    _events = null;
    await IvsBroadcast.stop();

    final videoId = _creds?.videoId;
    if (videoId != null) {
      await _liveService.endLive(videoId);
      await _forgetStranded();
      VideoService.clearAudienceCaches();
    }

    if (!mounted) return;
    setState(() {
      _stage = _Stage.setup;
      _creds = null;
      _onAir = false;
      _onAirSince = null;
      _viewerCount = null;
      _broadcastState = IvsBroadcastState.disconnected;
      _error = error;
      _cameraTimeoutNotice = notice;
    });
  }

  // ── in-broadcast controls ──────────────────────────────────────────────

  Future<void> _toggleMic() async {
    final next = !_micMuted;
    final ok = await IvsBroadcast.setMicMuted(next);
    if (!mounted) return;
    if (ok) {
      setState(() => _micMuted = next);
    } else {
      _showSnack("Couldn't change the microphone right now.");
    }
  }

  Future<void> _toggleCamera() async {
    final next = !_cameraOn;
    final ok = await IvsBroadcast.setCameraEnabled(next);
    if (!mounted) return;
    if (ok) {
      setState(() => _cameraOn = next);
    } else {
      _showSnack("Couldn't change the camera right now.");
    }
  }

  Future<void> _switchCamera() async {
    if (_switchingCamera) return;
    setState(() => _switchingCamera = true);
    final ok = await IvsBroadcast.switchCamera();
    if (!mounted) return;
    setState(() {
      _switchingCamera = false;
      if (ok) _frontCamera = !_frontCamera;
    });
    if (!ok) _showSnack("Couldn't switch cameras.");
  }

  // ── ending ─────────────────────────────────────────────────────────────

  Future<bool> _confirmEnd() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: context.bgModal,
        title: Text(
          'End live stream?',
          style: TextStyle(
            color: context.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Text(
          _stage == _Stage.encoder
              ? 'This stops your stream from showing as live. Also stop '
                    'broadcasting from your streaming app.'
              : 'Your camera and microphone will switch off and viewers will '
                    'stop seeing you.',
          style: TextStyle(color: context.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('End Stream'),
          ),
        ],
      ),
    );
    return confirmed == true;
  }

  Future<void> _endStream({bool confirm = true}) async {
    if (_ending) return;
    final videoId = _creds?.videoId;
    if (videoId == null) return;
    if (confirm && !await _confirmEnd()) return;
    if (!mounted) return;

    setState(() => _ending = true);

    _cameraWatchdog?.cancel();
    _cameraWatchdog = null;
    await _events?.cancel();
    _events = null;
    await IvsBroadcast.stop();

    _previewController?.dispose();
    _previewController = null;

    final ok = await _liveService.endLive(videoId);
    await _forgetStranded();
    if (!mounted) return;

    setState(() => _ending = false);
    // The broadcast is over — stop the clock and the viewer poll rather than
    // leaving a 1-second timer running behind the "ended" screen.
    _stopAirTimers();

    if (ok) {
      VideoService.clearAudienceCaches();
      setState(() {
        _stage = _Stage.ended;
        _onAir = false;
        _onAirSince = null;
        _viewerCount = null;
      });
    } else {
      // The camera is already off either way — say what actually happened
      // rather than implying they're still broadcasting.
      _showSnack(
        "Broadcasting stopped, but we couldn't mark the stream ended. Try again.",
      );
      setState(() {
        _stage = _Stage.ended;
        _onAir = false;
        _onAirSince = null;
        _viewerCount = null;
      });
    }
  }

  // ── encoder-path preview ───────────────────────────────────────────────

  Future<void> _togglePreview() async {
    if (_previewController != null) {
      _previewController!.dispose();
      setState(() {
        _previewController = null;
        _previewFailed = false;
      });
      return;
    }

    final url = _creds?.playbackUrl;
    if (url == null) return;

    setState(() {
      _previewLoading = true;
      _previewFailed = false;
    });

    try {
      final controller = VideoPlayerController.networkUrl(Uri.parse(url));
      await controller.initialize();
      if (!mounted) {
        controller.dispose();
        return;
      }
      controller.play();
      setState(() {
        _previewController = controller;
        _previewLoading = false;
      });
    } catch (e) {
      _logger.w('Live preview not ready yet: $e');
      if (!mounted) return;
      setState(() {
        _previewLoading = false;
        _previewFailed = true;
      });
    }
  }

  Future<void> _copy(String label, String? value) async {
    if (value == null) return;
    await Clipboard.setData(ClipboardData(text: value));
    _showSnack('$label copied.');
  }

  Future<void> _openTitleAssist() async {
    final picked = await showAITitleAssistSheet(
      context,
      initialDescription: _descriptionController.text.trim(),
      buildContext: (userDescription) => AIPromptContext(
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        // Matches the website's own live-page call exactly.
        category: 'Live',
        contentType: 'video',
        userDescription: userDescription,
      ),
    );
    if (picked == null || !mounted) return;
    setState(() => _titleController.text = picked);
  }

  // ── build ──────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final locked = _broadcasting || _stage == _Stage.encoder;
    return PopScope(
      canPop: !locked,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop || !locked) return;
        if (await _confirmEnd()) {
          await _endStream(confirm: false);
          // context.mounted, not State.mounted: this is build()'s own
          // BuildContext, which the analyzer can't tie back to the State.
          if (context.mounted) context.pop();
        }
      },
      child: PatternBackground(
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
            elevation: 0,
            iconTheme: IconThemeData(color: context.textPrimary),
            // Hidden while actually broadcasting so nobody walks away from a
            // live stream by accident — same reasoning as the website hiding
            // its back button once you're on air.
            automaticallyImplyLeading: !locked,
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _onAir ? 'You are LIVE' : 'Go Live',
                  style: TextStyle(
                    color: context.textPrimary,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
                // Elapsed time is local and always true. The viewer count is
                // only shown once IVS has actually reported one — an absent
                // number is left absent rather than rendered as "0 watching",
                // which would tell a broadcaster nobody is there when the
                // truth is that nobody has counted yet.
                if (_onAir && _onAirSince != null)
                  Text(
                    () {
                      final elapsed = _formatElapsed(
                        DateTime.now().difference(_onAirSince!),
                      );
                      final count = _viewerCount;
                      if (count == null) return elapsed;
                      return '$elapsed  ·  $count '
                          '${count == 1 ? 'viewer' : 'viewers'}';
                    }(),
                    style: TextStyle(
                      color: context.textSecondary,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ),
          body: SafeArea(child: _buildStage()),
        ),
      ),
    );
  }

  /// Runs the on-air clock and the viewer-count poll.
  ///
  /// The clock ticks locally every second; the viewer count is polled every
  /// 15 seconds, which is as often as it is worth asking — IVS updates it
  /// on its own cadence and a tighter loop would just burn battery and
  /// requests for a number that has not moved.
  void _startAirTimers() {
    _airTimer?.cancel();
    _airTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _onAir) setState(() {});
    });

    _viewerPollTimer?.cancel();
    unawaited(_pollViewerCount());
    _viewerPollTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => unawaited(_pollViewerCount()),
    );
  }

  void _stopAirTimers() {
    _airTimer?.cancel();
    _airTimer = null;
    _viewerPollTimer?.cancel();
    _viewerPollTimer = null;
  }

  Future<void> _pollViewerCount() async {
    final videoId = _creds?.videoId;
    if (videoId == null || !mounted || !_onAir) return;
    final count = await _liveService.getViewerCount(videoId);
    if (!mounted) return;
    setState(() => _viewerCount = count);
  }

  String _formatElapsed(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return h > 0 ? '$h:$m:$s' : '$m:$s';
  }

  Widget _buildStage() {
    switch (_stage) {
      case _Stage.setup:
        return _buildSetup();
      case _Stage.starting:
        return _buildStarting();
      case _Stage.live:
        return _buildBroadcasting();
      case _Stage.encoder:
        return _buildEncoder();
      case _Stage.ended:
        return _buildEnded();
    }
  }

  Widget _buildStarting() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: AppColors.brandOrange),
          const SizedBox(height: 16),
          Text(
            'Connecting…',
            style: TextStyle(
              color: context.textSecondary,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.6,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSetup() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_strandedVideoId != null) ...[
          _buildStrandedBanner(),
          const SizedBox(height: 16),
        ],
        _buildIntroBanner(),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(child: _label('Title')),
            TextButton.icon(
              onPressed: _openTitleAssist,
              icon: const Icon(Icons.auto_awesome, size: 16),
              label: const Text('AI title'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.brandOrange,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                visualDensity: VisualDensity.compact,
              ),
            ),
          ],
        ),
        TextField(
          controller: _titleController,
          maxLength: 100,
          style: TextStyle(color: context.textPrimary),
          decoration: _inputDecoration('Give your stream a title'),
        ),
        _label('Description'),
        TextField(
          controller: _descriptionController,
          maxLength: 500,
          maxLines: 3,
          style: TextStyle(color: context.textPrimary),
          decoration: _inputDecoration(
            'Tell viewers what this stream is about',
          ),
        ),
        _label('Visibility'),
        DropdownButtonFormField<String>(
          initialValue: _visibility,
          dropdownColor: context.bgCard,
          style: TextStyle(color: context.textPrimary),
          decoration: _inputDecoration(null),
          items: _visibilityOptions
              .map(
                (o) => DropdownMenuItem(
                  value: o.value,
                  child: Text(o.label, overflow: TextOverflow.ellipsis),
                ),
              )
              .toList(),
          onChanged: (v) => setState(() => _visibility = v ?? _visibility),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeThumbColor: AppColors.brandOrange,
          title: Text(
            'Comments enabled',
            style: TextStyle(
              color: context.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          value: _commentsEnabled,
          onChanged: (v) => setState(() => _commentsEnabled = v),
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(
            _error!,
            style: const TextStyle(color: AppColors.error, fontSize: 13),
          ),
        ],
        if (_cameraTimeoutNotice != null) ...[
          const SizedBox(height: 12),
          _buildCameraNotice(),
        ],
        const SizedBox(height: 20),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            gradient: AppColors.flameGradient,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: AppColors.brandOrange.withValues(alpha: 0.3),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: ElevatedButton.icon(
            onPressed: _checkingSupport ? null : _goLive,
            icon: const Icon(Icons.podcasts, color: Colors.black),
            label: Text(
              _nativeSupported ? 'Start Broadcast' : 'Create Live Stream',
              style: const TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w800,
                fontSize: 15,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.transparent,
              shadowColor: Colors.transparent,
              minimumSize: const Size(double.infinity, 52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  /// On a phone that can broadcast natively there is nothing to explain —
  /// the form below is self-evident — so this is just a section title.
  ///
  /// The notice is kept only for the phones that CANNOT broadcast in-app.
  /// There the screen silently changes into a stream-key handout, and
  /// without a line saying why, a server URL appearing where a camera was
  /// expected reads as a bug.
  Widget _buildIntroBanner() {
    if (_nativeSupported) {
      return Row(
        children: [
          const Icon(
            Icons.videocam_outlined,
            color: AppColors.brandOrange,
            size: 20,
          ),
          const SizedBox(width: 8),
          Text(
            'Set up your broadcast',
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.2,
            ),
          ),
        ],
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.brandOrange.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.brandOrange.withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline,
            color: AppColors.brandOrange,
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              "This phone's Android version can't broadcast from inside "
              "the app, so we'll give you a server URL and stream "
              'key to use in a streaming app like OBS or Larix.',
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 12.5,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStrandedBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _strandedTitle == null
                      ? 'An earlier stream is still marked live.'
                      : '"$_strandedTitle" is still marked live.',
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 12.5,
                    height: 1.4,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'The app closed before it was ended, so it still shows as '
                  'live on your channel.',
                  style: TextStyle(
                    color: context.textSecondary,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _clearingStranded
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.error,
                  ),
                )
              : TextButton(
                  onPressed: _endStranded,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.error,
                    visualDensity: VisualDensity.compact,
                  ),
                  child: const Text('End it'),
                ),
        ],
      ),
    );
  }

  Widget _buildCameraNotice() {
    // Amber rather than red on purpose — nothing went wrong and nothing was
    // lost; the camera was simply released because the stream never started.
    const amber = Color(0xFFF59E0B);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: amber.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: amber.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.videocam_off_outlined, color: amber, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _cameraTimeoutNotice!,
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 12.5,
                height: 1.4,
              ),
            ),
          ),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: () => setState(() => _cameraTimeoutNotice = null),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Icon(Icons.close, size: 16, color: context.textDim),
            ),
          ),
        ],
      ),
    );
  }

  // ── native broadcasting UI ─────────────────────────────────────────────

  Widget _buildBroadcasting() {
    return Column(
      children: [
        // Deliberately OUTSIDE the scrolling area below. An embedded native
        // camera preview inside a scrolling list is a well-known source of
        // flicker and blank frames on Android, and nothing on this screen
        // needs the video itself to scroll.
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: _buildPreviewFrame(),
        ),
        Expanded(child: _buildBroadcastControls()),
      ],
    );
  }

  Widget _buildPreviewFrame() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: AspectRatio(
        // 16:9 because that is what STANDARD_LANDSCAPE actually sends — the
        // same shape the website's preview canvas shows and the same shape
        // the watch page plays back.
        aspectRatio: 16 / 9,
        child: Stack(
          fit: StackFit.expand,
          children: [
            const ColoredBox(color: Colors.black),
            const IvsPreview(),

            // Every rendering path the native side knows about failed on this
            // handset. Say so plainly: the preview is a local convenience and
            // the broadcast does not depend on it, so the one unacceptable
            // outcome is someone assuming a black rectangle means they are
            // off air when they are not.
            if (_previewReady == false)
              Container(
                color: Colors.black,
                alignment: Alignment.center,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.visibility_off_outlined,
                        color: Colors.white.withValues(alpha: 0.45),
                        size: 28,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _onAir
                            ? "This phone can't show a preview — but you are "
                                  'live, and viewers can see and hear you '
                                  'normally.'
                            : "This phone can't show a preview.",
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 12,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            if (!_cameraOn && _onAir)
              Container(
                color: Colors.black,
                alignment: Alignment.center,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.videocam_off_outlined,
                      color: Colors.white.withValues(alpha: 0.5),
                      size: 30,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Camera off — viewers see black',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.6),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),

            if (!_onAir)
              Container(
                color: Colors.black.withValues(alpha: 0.45),
                alignment: Alignment.center,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CircularProgressIndicator(
                      color: AppColors.brandOrange,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _broadcastState == IvsBroadcastState.connecting
                          ? 'CONNECTING…'
                          : 'STARTING…',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ],
                ),
              ),

            if (_onAir)
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.error,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.circle, color: Colors.white, size: 7),
                      SizedBox(width: 6),
                      Text(
                        'LIVE',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildBroadcastControls() {
    // Only offered when the handset genuinely has a second camera to flip to.
    final canSwitch = _cameraPositions.length > 1;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        Text(
          _titleController.text.trim(),
          style: TextStyle(
            color: context.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          _onAir
              ? 'Broadcasting from this phone.'
              : 'Opening your camera and connecting to the server…',
          style: TextStyle(color: context.textSecondary, fontSize: 12.5),
        ),
        if (_deviceLostNotice != null) ...[
          const SizedBox(height: 12),
          _buildDeviceLostBanner(),
        ],
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _controlButton(
              icon: _micMuted ? Icons.mic_off : Icons.mic,
              label: _micMuted ? 'Unmute' : 'Mute',
              active: _micMuted,
              onTap: _onAir ? _toggleMic : null,
            ),
            const SizedBox(width: 14),
            _controlButton(
              icon: _cameraOn ? Icons.videocam : Icons.videocam_off,
              label: _cameraOn ? 'Camera off' : 'Camera on',
              active: !_cameraOn,
              onTap: _onAir ? _toggleCamera : null,
            ),
            if (canSwitch) ...[
              const SizedBox(width: 14),
              _controlButton(
                icon: Icons.cameraswitch_outlined,
                label: _frontCamera ? 'Back cam' : 'Front cam',
                active: false,
                busy: _switchingCamera,
                onTap: _onAir && !_switchingCamera ? _switchCamera : null,
              ),
            ],
          ],
        ),
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.error, fontSize: 12.5),
          ),
        ],
        const SizedBox(height: 28),
        ElevatedButton.icon(
          onPressed: _ending ? null : () => _endStream(),
          icon: _ending
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.stop_circle_outlined),
          label: Text(_ending ? 'Ending…' : 'End Stream'),
          style: ElevatedButton.styleFrom(
            minimumSize: const Size(double.infinity, 52),
            backgroundColor: AppColors.error,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDeviceLostBanner() {
    const amber = Color(0xFFF59E0B);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: amber.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: amber.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded, color: amber, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _deviceLostNotice!,
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 12,
                height: 1.4,
              ),
            ),
          ),
          GestureDetector(
            onTap: () => setState(() => _deviceLostNotice = null),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Icon(Icons.close, size: 15, color: context.textDim),
            ),
          ),
        ],
      ),
    );
  }

  Widget _controlButton({
    required IconData icon,
    required String label,
    required bool active,
    required VoidCallback? onTap,
    bool busy = false,
  }) {
    final enabled = onTap != null;
    final background = active
        ? AppColors.error
        : (context.isDark ? Colors.white10 : Colors.black12);
    final foreground = active
        ? Colors.white
        : (enabled ? context.textPrimary : context.textDim);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: background,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(
              width: 54,
              height: 54,
              child: busy
                  ? const Padding(
                      padding: EdgeInsets.all(17),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.brandOrange,
                      ),
                    )
                  : Icon(icon, color: foreground, size: 22),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(
            color: enabled ? context.textSecondary : context.textDim,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  // ── external-encoder UI (Android 8 and older) ──────────────────────────

  Widget _buildEncoder() {
    final creds = _creds!;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.red,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.circle, color: Colors.white, size: 8),
              SizedBox(width: 8),
              Text(
                'LIVE SESSION CREATED',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          _titleController.text.trim(),
          style: TextStyle(
            color: context.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 20),
        _sectionTitle('1. Open your streaming app'),
        const SizedBox(height: 4),
        Text(
          'Use OBS Studio, Streamlabs, Larix Broadcaster, or any app that '
          'streams to a custom RTMP server. Enter these two values there:',
          style: TextStyle(
            color: context.textSecondary,
            fontSize: 13,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 12),
        _credRow(
          'Server URL',
          creds.rtmpsServerUrl ?? '—',
          onCopy: () => _copy('Server URL', creds.rtmpsServerUrl),
        ),
        const SizedBox(height: 8),
        _credRow(
          'Stream Key',
          _showStreamKey
              ? (creds.streamKey ?? '—')
              : List.filled(24, '•').join(),
          onCopy: () => _copy('Stream key', creds.streamKey),
          trailing: IconButton(
            icon: Icon(
              _showStreamKey ? Icons.visibility_off : Icons.visibility,
              color: context.textDim,
              size: 18,
            ),
            onPressed: () => setState(() => _showStreamKey = !_showStreamKey),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          "Don't share your stream key — anyone with it can broadcast to your "
          'channel.',
          style: TextStyle(color: context.textDim, fontSize: 11),
        ),
        const SizedBox(height: 24),
        _sectionTitle('2. Press "Start Streaming" there'),
        const SizedBox(height: 4),
        Text(
          'Your stream goes live on InPlayer as soon as your app connects and '
          'starts sending video.',
          style: TextStyle(
            color: context.textSecondary,
            fontSize: 13,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 20),
        _sectionTitle('Preview'),
        const SizedBox(height: 8),
        AspectRatio(
          aspectRatio: 16 / 9,
          child: Container(
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(16),
            ),
            clipBehavior: Clip.antiAlias,
            child:
                _previewController != null &&
                    _previewController!.value.isInitialized
                ? VideoPlayer(_previewController!)
                : Center(
                    child: _previewLoading
                        ? const CircularProgressIndicator(
                            color: AppColors.brandOrange,
                          )
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.videocam_off_outlined,
                                color: Colors.white.withValues(alpha: 0.3),
                                size: 32,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _previewFailed
                                    ? 'Not receiving video yet — start broadcasting first.'
                                    : 'Preview not started',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.4),
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                  ),
          ),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: _togglePreview,
          icon: Icon(
            _previewController != null ? Icons.stop : Icons.play_arrow,
          ),
          label: Text(
            _previewController != null ? 'Stop Preview' : 'Load Preview',
          ),
          style: OutlinedButton.styleFrom(
            side: BorderSide(color: context.borderSubtle),
            foregroundColor: context.textPrimary,
          ),
        ),
        const SizedBox(height: 28),
        ElevatedButton.icon(
          onPressed: _ending ? null : () => _endStream(),
          icon: const Icon(Icons.stop_circle_outlined),
          label: const Text('End Stream'),
          style: ElevatedButton.styleFrom(
            minimumSize: const Size(double.infinity, 52),
            backgroundColor: AppColors.error,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildEnded() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.check_circle,
              color: AppColors.brandOrange,
              size: 56,
            ),
            const SizedBox(height: 16),
            Text(
              'Stream ended',
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brandOrange,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String text) => Text(
    text,
    style: TextStyle(
      color: context.textPrimary,
      fontWeight: FontWeight.bold,
      fontSize: 14,
    ),
  );

  Widget _credRow(
    String label,
    String value, {
    required VoidCallback onCopy,
    Widget? trailing,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(color: context.textDim, fontSize: 11),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
          trailing ?? const SizedBox.shrink(),
          IconButton(
            icon: const Icon(
              Icons.copy,
              color: AppColors.brandOrange,
              size: 18,
            ),
            onPressed: onCopy,
          ),
        ],
      ),
    );
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(top: 16, bottom: 6),
    child: Text(
      text,
      style: TextStyle(
        color: context.textSecondary,
        fontWeight: FontWeight.w600,
        fontSize: 13,
      ),
    ),
  );

  InputDecoration _inputDecoration(String? hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: context.textDim, fontSize: 13),
      filled: true,
      fillColor: context.bgCard,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: context.borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: context.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.brandOrange, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }
}
