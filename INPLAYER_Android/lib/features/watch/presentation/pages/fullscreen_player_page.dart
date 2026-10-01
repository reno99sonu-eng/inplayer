import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:native_device_orientation/native_device_orientation.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/utils/webvtt_parser.dart';
import '../../../../services/caption_service.dart';
import '../widgets/player_chrome.dart';

/// Landscape, immersive fullscreen playback — reuses the SAME
/// `VideoPlayerController` the watch page already created (never
/// re-initializes it), so entering/leaving fullscreen never causes a
/// re-buffer or a visible restart. Mirrors the website's own "rotate the
/// phone to landscape → fullscreen; rotate back → exit" + manual toggle
/// behavior (see VideoPlayer.tsx's `enterFullscreen`/`exitFullscreen`/the
/// device-rotation effect). WatchPage applies and awaits the Android
/// landscape lock before opening this route; this page monitors the raw
/// physical sensor so the lock does not hide a deliberate rotate-back.
///
/// Controller/media-surface/quality-label are all pulled through getters
/// rather than passed once as plain values: a quality change made *while*
/// fullscreen is open swaps the underlying `VideoPlayerController` on the
/// watch page (see `_WatchPageState._switchQuality`), so this page has to
/// re-read the live controller afterward rather than holding on to a
/// reference that's about to be disposed out from under it.
class FullscreenPlayerPage extends StatefulWidget {
  final VideoPlayerController Function() getController;
  final Widget Function() getMediaSurface;
  final double Function() getDisplayAspectRatio;
  final String title;
  final String Function() getQualityLabel;
  final List<QualityOption> qualityOptions;
  final Future<void> Function(String) onQualityChange;

  // Captions — the language list is fetched once by WatchPage and doesn't
  // change mid-session, so it's passed as a plain value; the selected
  // language and its parsed cues are read live via getters (same pattern as
  // getController/getMediaSurface) since a viewer can open the caption menu
  // while already in fullscreen.
  final List<CaptionLanguage> captionLanguages;
  final String? Function() getSelectedCaptionLang;
  final List<CaptionCue> Function() getCaptionCues;
  final Future<void> Function(String?) onCaptionLanguageChange;

  // Picture-in-Picture — same pipSupported/onPipTapped shape PlayerChrome
  // already takes on the plain watch page, threaded through here so the
  // manual PiP button also works while already in landscape fullscreen, not
  // just from the portrait watch page.
  final bool pipSupported;
  final VoidCallback? onPipTapped;

  // Brightness. Deliberately owned by WatchPage rather than by either
  // player: the ColorFilter has to sit on the media surface itself, because
  // PlayerChrome renders on TOP of the video — filtering inside it tints
  // only the chrome and leaves the picture alone, which is exactly how the
  // brightness swipe came to do nothing at all. WatchPage is what builds
  // that surface for both players (see getMediaSurface above), so it holds
  // the value. A getter rather than a plain value so fullscreen opens at
  // whatever the inline player was last set to instead of snapping back to
  // 1.0; the callback keeps the two in step on the way back out.
  final double Function() getBrightness;
  final ValueChanged<double> onBrightnessChanged;
  final Widget? Function()? getAdOverlay;
  final ValueListenable<int>? adListenable;

  const FullscreenPlayerPage({
    super.key,
    required this.getController,
    required this.getMediaSurface,
    required this.getDisplayAspectRatio,
    required this.title,
    required this.getQualityLabel,
    required this.qualityOptions,
    required this.onQualityChange,
    this.captionLanguages = const [],
    required this.getSelectedCaptionLang,
    required this.getCaptionCues,
    required this.onCaptionLanguageChange,
    this.pipSupported = false,
    this.onPipTapped,
    required this.getBrightness,
    required this.onBrightnessChanged,
    this.getAdOverlay,
    this.adListenable,
    this.portrait = false,
  });

  /// The video itself is vertical. WatchPage then keeps fullscreen upright
  /// instead of locking landscape (a 9:16 clip on a landscape screen is
  /// SMALLER than inline), and the landscape-only rotate-to-exit gesture is
  /// not used — the back/close buttons exit.
  final bool portrait;

  @override
  State<FullscreenPlayerPage> createState() => _FullscreenPlayerPageState();
}

class _FullscreenPlayerPageState extends State<FullscreenPlayerPage> {
  // Rotate-to-exit — the other half of "rotate the phone" fullscreen
  // behavior (rotate-*in* lives in watch_page.dart's didChangeMetrics,
  // which only works because nothing has locked the app's orientation yet
  // at that point). Once WatchPage locks the rendered orientation to
  // landscape below, Flutter's own MediaQuery/window-metrics APIs stop
  // reflecting the phone's real physical orientation — only a raw sensor
  // reading (native_device_orientation, useSensor: true) still can, which
  // is what this subscription is for: rotating physically back to portrait
  // while this page is open now auto-exits, matching the website's own
  // bidirectional rotation trigger.
  StreamSubscription<NativeDeviceOrientation>? _orientationSub;
  Timer? _portraitExitTimer;
  bool _exiting = false;
  // Rotate-to-exit must be a genuine "rotate back" gesture and must never
  // fire on entry. When fullscreen is opened by TAPPING the button while the
  // phone is physically upright, the raw sensor stream reports portraitUp
  // immediately (on subscribe / on the first tick), which would otherwise pop
  // straight back out to portrait. So only arm the portrait->exit trigger
  // after we've actually observed a physical landscape reading first.
  bool _seenLandscape = false;
  NativeDeviceOrientation? _lastPhysicalOrientation;

  @override
  void initState() {
    super.initState();
    if (widget.portrait) return;
    _orientationSub = NativeDeviceOrientationCommunicator()
        .onOrientationChanged(useSensor: true)
        .listen(_handlePhysicalOrientationChanged);
  }

  void _handlePhysicalOrientationChanged(NativeDeviceOrientation orientation) {
    if (!mounted) return;
    _lastPhysicalOrientation = orientation;
    // Arm the exit trigger only once the phone has physically been in
    // landscape. Until then, ignore portrait readings so tapping the
    // fullscreen button while upright doesn't immediately bounce back out.
    if (orientation == NativeDeviceOrientation.landscapeLeft ||
        orientation == NativeDeviceOrientation.landscapeRight) {
      _seenLandscape = true;
      _portraitExitTimer?.cancel();
      _portraitExitTimer = null;
      return;
    }
    if (!_seenLandscape) return;
    if (orientation == NativeDeviceOrientation.portraitUp ||
        orientation == NativeDeviceOrientation.portraitDown) {
      // Phone sensors can briefly report portrait while the Android window
      // is settling into a requested landscape orientation. Require a
      // stable portrait reading before exiting, or fullscreen appears to
      // randomly unlock while a video is playing.
      if (_portraitExitTimer?.isActive == true) return;
      _portraitExitTimer?.cancel();
      _portraitExitTimer = Timer(const Duration(milliseconds: 500), () {
        final last = _lastPhysicalOrientation;
        if (!mounted ||
            !_seenLandscape ||
            (last != NativeDeviceOrientation.portraitUp &&
                last != NativeDeviceOrientation.portraitDown)) {
          return;
        }
        _exit();
      });
    }
  }

  Future<void> _handleQualityChange(String label) async {
    await widget.onQualityChange(label);
    // The parent just disposed the old controller and assigned a new one —
    // re-read it so PlayerChrome below is never left holding a disposed
    // reference.
    if (mounted) setState(() {});
  }

  Future<void> _handleCaptionChange(String? code) async {
    await widget.onCaptionLanguageChange(code);
    if (mounted) setState(() {});
  }

  Future<void> _exit() async {
    // Guards against a double-pop: the manual close button, the system back
    // gesture, and the rotate-to-exit sensor can race within the same frame.
    if (_exiting) return;
    _exiting = true;
    // WatchPage may already have removed this route (the OS just floated the
    // app into PiP) while this State is still briefly mounted. A blind pop()
    // then would pop WatchPage itself — disposing the video and leaving the
    // home UI inside the PiP window. Only pop when this page is on top.
    if (mounted && (ModalRoute.of(context)?.isCurrent ?? false)) {
      Navigator.of(context).pop();
    } else {
      _exiting = false;
    }
  }

  @override
  void dispose() {
    _orientationSub?.cancel();
    _portraitExitTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SizedBox.expand(
          child: Stack(
            alignment: Alignment.center,
            children: [
              Center(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final requestedRatio = widget.getDisplayAspectRatio();
                    final ratio = requestedRatio.isFinite && requestedRatio > 0
                        ? requestedRatio
                        : 16 / 9;
                    final width = math.min(
                      constraints.maxWidth,
                      constraints.maxHeight * ratio,
                    );
                    final height = width / ratio;
                    return SizedBox(
                      width: width,
                      height: height,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          widget.getMediaSurface(),
                          Positioned.fill(
                            child: PlayerChrome(
                              controller: widget.getController(),
                              title: widget.title,
                              isFullscreen: true,
                              onToggleFullscreen: _exit,
                              onBack: _exit,
                              qualityLabel: widget.getQualityLabel(),
                              qualityOptions: widget.qualityOptions,
                              onQualityChange: _handleQualityChange,
                              captionLanguages: widget.captionLanguages,
                              selectedCaptionLang: widget
                                  .getSelectedCaptionLang(),
                              captionCues: widget.getCaptionCues(),
                              onCaptionLanguageChange: _handleCaptionChange,
                              pipSupported: widget.pipSupported,
                              onPipTapped: widget.onPipTapped,
                              initialBrightness: widget.getBrightness(),
                              onBrightnessChanged: (v) {
                                widget.onBrightnessChanged(v);
                                // Rebuild so getMediaSurface() below is
                                // re-invoked with the new brightness value.
                                if (mounted) setState(() {});
                              },
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              if (widget.getAdOverlay != null && widget.adListenable != null)
                ValueListenableBuilder<int>(
                  valueListenable: widget.adListenable!,
                  builder: (context, _, child) {
                    final overlay = widget.getAdOverlay!();
                    if (overlay == null) return const SizedBox.shrink();
                    return Positioned.fill(child: overlay);
                  },
                )
              else if (widget.getAdOverlay != null &&
                  widget.getAdOverlay!() != null)
                Positioned.fill(child: widget.getAdOverlay!()!),
            ],
          ),
      ),
    );
  }
}
