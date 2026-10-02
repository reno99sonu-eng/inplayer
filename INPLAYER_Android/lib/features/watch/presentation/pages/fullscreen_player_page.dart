import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/utils/webvtt_parser.dart';
import '../../../../services/caption_service.dart';
import '../widgets/player_chrome.dart';

/// Landscape, immersive fullscreen playback — reuses the SAME
/// `VideoPlayerController` the watch page already created (never
/// re-initializes it), so entering/leaving fullscreen never causes a
/// re-buffer or a visible restart. The page remains locked in landscape until
/// the viewer explicitly exits fullscreen, even if the phone is turned back
/// upright. WatchPage applies and awaits the Android landscape lock before
/// opening this route and restores automatic rotation after it closes.
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
  });

  @override
  State<FullscreenPlayerPage> createState() => _FullscreenPlayerPageState();
}

class _FullscreenPlayerPageState extends State<FullscreenPlayerPage> {
  bool _exiting = false;

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
    // Guards against a double-pop if the close button and system back gesture
    // race within the same frame.
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
