import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
/// device-rotation effect), reimplemented with `SystemChrome` orientation
/// locking + immersive system UI instead of the web Fullscreen API.
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

  const FullscreenPlayerPage({
    super.key,
    required this.getController,
    required this.getMediaSurface,
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
  });

  @override
  State<FullscreenPlayerPage> createState() => _FullscreenPlayerPageState();
}

class _FullscreenPlayerPageState extends State<FullscreenPlayerPage> {
  // Rotate-to-exit — the other half of "rotate the phone" fullscreen
  // behavior (rotate-*in* lives in watch_page.dart's didChangeMetrics,
  // which only works because nothing has locked the app's orientation yet
  // at that point). Once this page locks the rendered orientation to
  // landscape below, Flutter's own MediaQuery/window-metrics APIs stop
  // reflecting the phone's real physical orientation — only a raw sensor
  // reading (native_device_orientation, useSensor: true) still can, which
  // is what this subscription is for: rotating physically back to portrait
  // while this page is open now auto-exits, matching the website's own
  // bidirectional rotation trigger.
  StreamSubscription<NativeDeviceOrientation>? _orientationSub;
  bool _exiting = false;

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _orientationSub = NativeDeviceOrientationCommunicator()
        .onOrientationChanged(useSensor: true)
        .listen(_handlePhysicalOrientationChanged);
  }

  void _handlePhysicalOrientationChanged(NativeDeviceOrientation orientation) {
    if (!mounted) return;
    if (orientation == NativeDeviceOrientation.portraitUp ||
        orientation == NativeDeviceOrientation.portraitDown) {
      _exit();
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
    // Guards against a double-pop: the manual close button, the back
    // gesture (via PopScope below), and the new rotate-to-exit sensor
    // listener can all now race to call this within the same frame or two.
    if (_exiting) return;
    _exiting = true;
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _orientationSub?.cancel();
    // Belt-and-braces restore in case the page is popped by something other
    // than the back button (e.g. a system back gesture) without _exit()
    // running first — a fullscreen watch page must never leak a landscape
    // lock or immersive mode onto the rest of the app.
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) return;
        SystemChrome.setPreferredOrientations([
          DeviceOrientation.portraitUp,
          DeviceOrientation.portraitDown,
        ]);
        SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: SizedBox.expand(
          child: Stack(
            alignment: Alignment.center,
            children: [
              widget.getMediaSurface(),
              PlayerChrome(
                controller: widget.getController(),
                title: widget.title,
                isFullscreen: true,
                onToggleFullscreen: _exit,
                onBack: _exit,
                qualityLabel: widget.getQualityLabel(),
                qualityOptions: widget.qualityOptions,
                onQualityChange: _handleQualityChange,
                captionLanguages: widget.captionLanguages,
                selectedCaptionLang: widget.getSelectedCaptionLang(),
                captionCues: widget.getCaptionCues(),
                onCaptionLanguageChange: _handleCaptionChange,
                pipSupported: widget.pipSupported,
                onPipTapped: widget.onPipTapped,
                initialBrightness: widget.getBrightness(),
                onBrightnessChanged: (v) {
                  widget.onBrightnessChanged(v);
                  // Rebuild so getMediaSurface() below is re-invoked with
                  // the new value — WatchPage's own setState can't reach
                  // this page's subtree.
                  if (mounted) setState(() {});
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
