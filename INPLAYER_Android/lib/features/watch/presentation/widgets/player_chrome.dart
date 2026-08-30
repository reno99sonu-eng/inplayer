import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/webvtt_parser.dart';
import '../../../../services/caption_service.dart';

/// One quality ceiling option shown in the Quality menu — mirrors the
/// website's `maxResolution` prop on `<mux-player>` (see VideoPlayer.tsx).
/// `heightPx` is null for "Auto" (no cap beyond whatever the viewer's own
/// Premium tier already enforces).
class QualityOption {
  final String label;
  final int? heightPx;
  const QualityOption(this.label, this.heightPx);
}

/// The real, interactive video-player chrome: tap-to-seek (chained
/// double/triple-tap, YouTube/website-style), a left-half brightness /
/// right-half volume vertical swipe, a real scrubber with a buffered-range
/// indicator, live elapsed/duration labels, a playback-speed menu, a
/// quality menu, and a fullscreen toggle.
///
/// This deliberately reproduces the *exact* tuning constants from the
/// website's own VideoPlayer.tsx (TAP_CHAIN_MS, SEEK_STEP_SECONDS, the
/// 40/20/40 tap-zone split, the 50/50 drag-zone split, the 12px drag
/// threshold, and the 0.5–1.5 brightness range) rather than approximating
/// them, so the gesture feel matches the site exactly, not just the look.
class PlayerChrome extends StatefulWidget {
  final VideoPlayerController controller;
  final String title;
  final bool isFullscreen;
  final VoidCallback onToggleFullscreen;
  final VoidCallback? onBack;
  final String qualityLabel;
  final List<QualityOption> qualityOptions;
  final ValueChanged<String> onQualityChange;

  // Captions. `captionLanguages` empty hides the CC button entirely (most
  // videos, and every video whose ASR transcript wasn't meaningful speech
  // — see app/lib/captions.ts). `captionCues` are the already-fetched,
  // already-parsed cues for `selectedCaptionLang` (null = Off); this widget
  // only picks the cue active at the current position and renders it — the
  // fetch/parse happens one level up (WatchPage), same split as quality.
  final List<CaptionLanguage> captionLanguages;
  final String? selectedCaptionLang;
  final List<CaptionCue> captionCues;
  final ValueChanged<String?> onCaptionLanguageChange;

  // Picture-in-Picture. `pipSupported` false hides the button entirely
  // (same pattern as `captionLanguages.isEmpty` hiding the CC button) —
  // covers both an OS below Android 7.0 and a caller that hasn't checked
  // yet, so this widget never has to guess.
  final bool pipSupported;
  final VoidCallback? onPipTapped;

  // Minimize into the small draggable corner window (see
  // video_mini_player_overlay.dart). Null hides the button entirely — the
  // same on/off-by-presence pattern as onPipTapped/pipSupported above.
  // Deliberately only ever passed from the plain inline player
  // (watch_page.dart): minimizing out of landscape fullscreen would also
  // need to unwind the orientation lock/immersive mode at the same time,
  // which is a separate piece of scope left for later rather than risked
  // here alongside everything else in this round.
  final VoidCallback? onMinimize;

  /// Brightness, lifted out of this widget so the parent can apply it to the
  /// actual video.
  ///
  /// The left-half vertical swipe is owned here (it shares a gesture
  /// recognizer with the tap-to-seek chain, so it has to be), but the pixels
  /// it needs to dim are NOT — this widget renders on top of the video, not
  /// around it. So the value is computed here and handed upward;
  /// watch_page.dart wraps the media surface in the ColorFilter, and
  /// fullscreen_player_page.dart inherits that for free because it renders
  /// the very same _buildMediaSurface().
  ///
  /// [initialBrightness] seeds the local value so opening fullscreen
  /// mid-drag doesn't snap the picture back to 1.0 — the new PlayerChrome
  /// instance picks up where the old one left off.
  final double initialBrightness;
  final ValueChanged<double>? onBrightnessChanged;

  const PlayerChrome({
    super.key,
    required this.controller,
    required this.title,
    required this.isFullscreen,
    required this.onToggleFullscreen,
    this.onBack,
    required this.qualityLabel,
    required this.qualityOptions,
    required this.onQualityChange,
    this.captionLanguages = const [],
    this.selectedCaptionLang,
    this.captionCues = const [],
    required this.onCaptionLanguageChange,
    this.pipSupported = false,
    this.onPipTapped,
    this.onMinimize,
    this.initialBrightness = 1.0,
    this.onBrightnessChanged,
  });

  @override
  State<PlayerChrome> createState() => _PlayerChromeState();
}

bool shouldTogglePlayOnTap(String? side, bool isPlaying) {
  // A paused video should react immediately to the first tap. If the code
  // waits for the chained-seek timer while the player is paused, a second tap
  // is interpreted as a seek instead of a resume, which leaves the video
  // stuck on the paused frame.
  return side == null || !isPlaying;
}

class _PlayerChromeState extends State<PlayerChrome> {
  // Multi-tap seek tuning — matches VideoPlayer.tsx exactly (see its own
  // comment on TAP_CHAIN_MS for why toggle and seek share one timer/window
  // instead of each having their own).
  static const _tapChainMs = 400;
  static const _seekStepSeconds = 10;
  static const _verticalDragThresholdPx = 12.0;
  static const _brightnessMin = 0.5;
  static const _brightnessMax = 1.5;
  static const _speedOptions = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  bool _controlsVisible = true;
  Timer? _hideControlsTimer;

  double _brightness = 1.0;
  double _playbackSpeed = 1.0;

  // Tap-chain state (side taps → play/pause vs. chained seek).
  String? _tapSide;
  int _tapCount = 0;
  int _tapLastTimeMs = 0;
  Timer? _tapToggleTimer;

  // Seek flash indicator ("+10s" / "-20s").
  String? _seekFlashSide;
  int _seekFlashSeconds = 0;
  Timer? _seekFlashTimer;

  // Vertical brightness/volume drag.
  Offset? _dragStart;
  bool _dragging = false;
  String? _dragKind; // 'brightness' | 'volume'
  double _dragStartBrightness = 1.0;
  double _dragStartVolume = 1.0;
  double? _dragIndicatorPercent;
  String? _dragIndicatorKind;

  @override
  void initState() {
    super.initState();
    // Seed from the parent so brightness survives entering/leaving
    // fullscreen (which builds a second, fresh PlayerChrome).
    _brightness = widget.initialBrightness;
    widget.controller.addListener(_onControllerTick);
    _scheduleAutoHide();
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerTick);
    _hideControlsTimer?.cancel();
    _tapToggleTimer?.cancel();
    _seekFlashTimer?.cancel();
    super.dispose();
  }

  void _onControllerTick() {
    if (mounted) setState(() {});
  }

  void _scheduleAutoHide() {
    _hideControlsTimer?.cancel();
    if (!widget.controller.value.isPlaying) return;
    _hideControlsTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() => _controlsVisible = false);
    });
  }

  void _showControlsBriefly() {
    setState(() => _controlsVisible = true);
    _scheduleAutoHide();
  }

  void _togglePlayPause() {
    final c = widget.controller;
    final value = c.value;
    if (value.isPlaying) {
      c.pause();
    } else {
      // A video parked exactly at its end is a dead end for play(): the
      // platform player is already sitting on the last frame and just stays
      // there, so the control appears completely dead no matter how many
      // times it's pressed — one of the ways this player could get "stuck".
      // Rewinding first is what any real player does with a replay press.
      // The 200ms tolerance covers streams whose final reported position
      // lands a few frames short of the declared duration.
      final duration = value.duration;
      final atEnd = duration > Duration.zero &&
          value.position >= duration - const Duration(milliseconds: 200);
      if (atEnd) c.seekTo(Duration.zero);
      c.play();
    }
    _showControlsBriefly();
  }

  void _clearToggleTimer() {
    _tapToggleTimer?.cancel();
    _tapToggleTimer = null;
  }

  void _applySeek(String side, int count) {
    final c = widget.controller;
    final duration = c.value.duration;
    if (duration == Duration.zero) return;
    final deltaSeconds = _seekStepSeconds * count * (side == 'left' ? -1 : 1);
    final current = c.value.position;
    var next = current + Duration(seconds: deltaSeconds);
    if (next < Duration.zero) next = Duration.zero;
    if (next > duration) next = duration;
    c.seekTo(next);

    _seekFlashTimer?.cancel();
    setState(() {
      _seekFlashSide = side;
      _seekFlashSeconds = _seekStepSeconds * count;
      _controlsVisible = true;
    });
    _seekFlashTimer = Timer(const Duration(milliseconds: 700), () {
      if (mounted) setState(() => _seekFlashSide = null);
    });
    _scheduleAutoHide();
  }

  void _handleTapUp(TapUpDetails details, Size size) {
    final dx = details.localPosition.dx;
    final side = dx < size.width * 0.4
        ? 'left'
        : dx > size.width * 0.6
            ? 'right'
            : null;

    final now = DateTime.now().millisecondsSinceEpoch;

    if (side != null &&
        _tapSide == side &&
        now - _tapLastTimeMs < _tapChainMs &&
        _tapCount >= 1) {
      _tapCount += 1;
      _tapLastTimeMs = now;
      _clearToggleTimer();
      _applySeek(side, _tapCount);
      return;
    }

    _tapSide = side;
    _tapCount = 1;
    _tapLastTimeMs = now;
    _clearToggleTimer();

    // Centre zone, OR a video that isn't currently playing: respond now.
    //
    // The 400ms wait further down exists so that a quick second tap on the
    // same side can upgrade itself into a seek rather than a play/pause.
    // That trade is only worth making while the video is actually playing.
    // On a paused video the delay is actively harmful: the first tap looks
    // like it did nothing, so people tap again — and because the chain
    // check above runs first, that second tap is read as a seek, which
    // cancels the pending toggle and scrubs instead of starting playback.
    // Tap again and the same thing happens. The video then never starts no
    // matter how many times it's tapped, which is exactly the "clicked the
    // player and it's stuck, won't play or pause" report this fixes.
    //
    // Nothing is lost by answering instantly here: the tap-state fields are
    // already updated above, so a genuine rapid double tap still chains
    // into a seek on the next tap — it just gets playback going first
    // instead of leaving the viewer staring at a frozen frame.
    if (shouldTogglePlayOnTap(side, widget.controller.value.isPlaying)) {
      _togglePlayPause();
      return;
    }

    // Might become a chained seek — wait the same window before committing
    // to a play/pause toggle (see TAP_CHAIN_MS comment on the website).
    _tapToggleTimer = Timer(const Duration(milliseconds: _tapChainMs), () {
      _tapToggleTimer = null;
      _togglePlayPause();
    });
    _showControlsBriefly();
  }

  void _handleVerticalDragStart(DragStartDetails details, Size size) {
    if (details.localPosition.dy > size.height - 64) return; // control-bar strip
    _dragStart = details.localPosition;
    _dragging = false;
    _dragKind = details.localPosition.dx < size.width / 2 ? 'brightness' : 'volume';
    _dragStartBrightness = _brightness;
    _dragStartVolume = widget.controller.value.volume;
  }

  void _handleVerticalDragUpdate(DragUpdateDetails details, Size size) {
    final start = _dragStart;
    if (start == null) return;
    final deltaY = start.dy - details.localPosition.dy; // up = positive

    if (!_dragging) {
      if (deltaY.abs() < _verticalDragThresholdPx) return;
      _dragging = true;
      _clearToggleTimer();
      _tapSide = null;
      _tapCount = 0;
    }

    final ratio = deltaY / size.height;

    if (_dragKind == 'brightness') {
      const range = _brightnessMax - _brightnessMin;
      final next = (_dragStartBrightness + ratio * range).clamp(_brightnessMin, _brightnessMax);
      setState(() {
        _brightness = next;
        _dragIndicatorKind = 'brightness';
        _dragIndicatorPercent = (next - _brightnessMin) / range;
      });
      // Hand it to whoever owns the actual video pixels — see the doc on
      // onBrightnessChanged. Without this the swipe moves the indicator and
      // nothing else, which is precisely how it was behaving.
      widget.onBrightnessChanged?.call(next);
    } else {
      final next = (_dragStartVolume + ratio).clamp(0.0, 1.0);
      widget.controller.setVolume(next);
      setState(() {
        _dragIndicatorKind = 'volume';
        _dragIndicatorPercent = next;
      });
    }
  }

  void _handleVerticalDragEnd(DragEndDetails details) {
    _dragStart = null;
    _dragging = false;
    _dragKind = null;
    setState(() {
      _dragIndicatorKind = null;
      _dragIndicatorPercent = null;
    });
  }

  void _showSpeedMenu() {
    _showControlsBriefly();
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0B1020),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Playback speed', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              ),
              for (final speed in _speedOptions)
                ListTile(
                  title: Text(
                    speed == 1.0 ? 'Normal' : '${_speedLabel(speed)}x',
                    style: TextStyle(
                      color: speed == _playbackSpeed ? AppColors.brandOrange : Colors.white,
                      fontWeight: speed == _playbackSpeed ? FontWeight.w800 : FontWeight.w500,
                    ),
                  ),
                  trailing: speed == _playbackSpeed ? const Icon(Icons.check, color: AppColors.brandOrange) : null,
                  onTap: () {
                    widget.controller.setPlaybackSpeed(speed);
                    setState(() => _playbackSpeed = speed);
                    Navigator.of(ctx).pop();
                  },
                ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  void _showQualityMenu() {
    _showControlsBriefly();
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0B1020),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Quality', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              ),
              for (final option in widget.qualityOptions)
                ListTile(
                  title: Text(
                    option.label,
                    style: TextStyle(
                      color: option.label == widget.qualityLabel ? AppColors.brandOrange : Colors.white,
                      fontWeight: option.label == widget.qualityLabel ? FontWeight.w800 : FontWeight.w500,
                    ),
                  ),
                  trailing: option.label == widget.qualityLabel ? const Icon(Icons.check, color: AppColors.brandOrange) : null,
                  onTap: () {
                    Navigator.of(ctx).pop();
                    widget.onQualityChange(option.label);
                  },
                ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  void _showCaptionsMenu() {
    _showControlsBriefly();
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0B1020),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Captions', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              ),
              ListTile(
                title: Text(
                  'Off',
                  style: TextStyle(
                    color: widget.selectedCaptionLang == null ? AppColors.brandOrange : Colors.white,
                    fontWeight: widget.selectedCaptionLang == null ? FontWeight.w800 : FontWeight.w500,
                  ),
                ),
                trailing: widget.selectedCaptionLang == null
                    ? const Icon(Icons.check, color: AppColors.brandOrange)
                    : null,
                onTap: () {
                  Navigator.of(ctx).pop();
                  widget.onCaptionLanguageChange(null);
                },
              ),
              for (final lang in widget.captionLanguages)
                ListTile(
                  title: Text(
                    lang.label,
                    style: TextStyle(
                      color: widget.selectedCaptionLang == lang.code ? AppColors.brandOrange : Colors.white,
                      fontWeight: widget.selectedCaptionLang == lang.code ? FontWeight.w800 : FontWeight.w500,
                    ),
                  ),
                  trailing: widget.selectedCaptionLang == lang.code
                      ? const Icon(Icons.check, color: AppColors.brandOrange)
                      : null,
                  onTap: () {
                    Navigator.of(ctx).pop();
                    widget.onCaptionLanguageChange(lang.code);
                  },
                ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  // The cue active at the controller's current position, or null. Recomputed
  // on every build (which already happens on every controller tick via
  // _onControllerTick), so captions stay in sync without a second timer.
  CaptionCue? _currentCaption() {
    if (widget.selectedCaptionLang == null || widget.captionCues.isEmpty) return null;
    return WebVttParser.cueAt(widget.captionCues, widget.controller.value.position);
  }

  // "1080p (Full HD)" -> "1080p", "Auto" -> "Auto" — the persistent bottom
  // bar has room for a short chip, not the full descriptive label the
  // Settings-style menu items use.
  String _qualityChipLabel(String label) {
    final parenIndex = label.indexOf('(');
    return parenIndex == -1 ? label : label.substring(0, parenIndex).trim();
  }

  // "2.0" -> "2", "1.75" -> "1.75" — drops a pointless trailing ".0" for
  // whole-number speeds without truncating real fractional ones.
  String _speedLabel(double speed) {
    return speed == speed.roundToDouble() ? speed.toStringAsFixed(0) : speed.toString();
  }

  String _fmt(Duration d) {
    if (d.isNegative || d == Duration.zero) return '0:00';
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    final s = d.inSeconds.remainder(60);
    if (h > 0) {
      return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  double _bufferedFraction() {
    final value = widget.controller.value;
    final duration = value.duration;
    if (duration == Duration.zero || value.buffered.isEmpty) return 0;
    final bufferedEnd = value.buffered.last.end;
    return (bufferedEnd.inMilliseconds / duration.inMilliseconds).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final value = widget.controller.value;
    final duration = value.duration;
    final position = value.position;
    final progress = duration == Duration.zero
        ? 0.0
        : (position.inMilliseconds / duration.inMilliseconds).clamp(0.0, 1.0);

    return LayoutBuilder(
      builder: (context, constraints) {
        final size = Size(constraints.maxWidth, constraints.maxHeight);
        // NOTE: the brightness ColorFilter deliberately does NOT live here.
        //
        // It used to wrap this whole subtree, which looked right but could
        // never have worked: PlayerChrome is stacked ON TOP of the video in
        // both watch_page.dart and fullscreen_player_page.dart, so a filter
        // applied here only ever tinted the chrome's own icons and scrims —
        // the picture underneath was untouched. Dragging on the left half
        // moved the indicator and changed nothing else.
        //
        // The filter now lives on the media surface itself (see
        // _WatchPageState._buildMediaSurface), driven by the
        // onBrightnessChanged callback below. Because FullscreenPlayerPage
        // renders that same _buildMediaSurface, fullscreen picks it up for
        // free rather than needing its own copy.
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapUp: (d) => _handleTapUp(d, size),
          onVerticalDragStart: (d) => _handleVerticalDragStart(d, size),
          onVerticalDragUpdate: (d) => _handleVerticalDragUpdate(d, size),
          onVerticalDragEnd: _handleVerticalDragEnd,
          child: Stack(
              alignment: Alignment.center,
              fit: StackFit.expand,
              children: [
                // Seek flash ("+10s" / "-20s")
                if (_seekFlashSide != null)
                  Align(
                    alignment: _seekFlashSide == 'left' ? Alignment.centerLeft : Alignment.centerRight,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(40),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _seekFlashSide == 'left' ? Icons.fast_rewind_rounded : Icons.fast_forward_rounded,
                              color: Colors.white,
                              size: 18,
                            ),
                            const SizedBox(width: 6),
                            Text('${_seekFlashSeconds}s', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
                          ],
                        ),
                      ),
                    ),
                  ),

                // Brightness/volume drag indicator
                if (_dragIndicatorKind != null && _dragIndicatorPercent != null)
                  Align(
                    alignment: _dragIndicatorKind == 'brightness' ? Alignment.centerLeft : Alignment.centerRight,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      child: Container(
                        width: 40,
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _dragIndicatorKind == 'brightness'
                                  ? Icons.brightness_6_rounded
                                  : (_dragIndicatorPercent! <= 0 ? Icons.volume_off_rounded : Icons.volume_up_rounded),
                              color: Colors.white,
                              size: 18,
                            ),
                            const SizedBox(height: 6),
                            SizedBox(
                              height: 60,
                              width: 4,
                              child: Stack(
                                alignment: Alignment.bottomCenter,
                                children: [
                                  Container(color: Colors.white.withValues(alpha: 0.25)),
                                  FractionallySizedBox(
                                    heightFactor: _dragIndicatorPercent!.clamp(0.0, 1.0),
                                    child: Container(color: AppColors.brandOrange),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                // Live caption cue — rendered regardless of chrome
                // visibility (real captions don't fade with the controls),
                // just shifted down to hug the bottom edge when the bar
                // that would otherwise sit under it is hidden.
                Builder(builder: (context) {
                  final cue = _currentCaption();
                  if (cue == null) return const SizedBox.shrink();
                  return Positioned(
                    left: 24,
                    right: 24,
                    bottom: _controlsVisible ? 74 : 20,
                    child: IgnorePointer(
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.72),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            cue.text,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              height: 1.3,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }),

                // Buffering spinner. `value.isPlaying` reflects INTENT
                // (play() was called and pause() wasn't) — not whether
                // frames are actually advancing. With no signal at all for
                // an in-progress stall, playback could freeze dead
                // mid-video with nothing on screen to explain why, reading
                // as the app hanging rather than the network catching up.
                // Shown regardless of _controlsVisible (same reasoning as
                // the caption cue above) since controls have usually
                // already auto-hidden by the time a real stall happens.
                if (value.isPlaying && value.isBuffering)
                  const IgnorePointer(
                    child: Center(
                      child: SizedBox(
                        width: 42,
                        height: 42,
                        child: CircularProgressIndicator(
                          strokeWidth: 3,
                          color: AppColors.brandOrange,
                        ),
                      ),
                    ),
                  ),

                if (_controlsVisible) ...[
                  // Top gradient / back / title
                  Positioned(
                    top: 0, left: 0, right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0xCC000000), Colors.transparent],
                        ),
                      ),
                      child: Row(
                        children: [
                          if (widget.onBack != null)
                            GestureDetector(
                              onTap: widget.onBack,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  widget.isFullscreen ? Icons.arrow_back_rounded : Icons.arrow_back_ios_new,
                                  color: Colors.white,
                                  size: 14,
                                ),
                              ),
                            ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              widget.title.toUpperCase(),
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (widget.onMinimize != null) ...[
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: widget.onMinimize,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.keyboard_arrow_down_rounded,
                                  color: Colors.white,
                                  size: 18,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),

                  // Center play/pause
                  if (!value.isPlaying)
                    IgnorePointer(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.5),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 44),
                      ),
                    ),

                  // Bottom control bar
                  Positioned(
                    bottom: 0, left: 0, right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [Color(0xCC000000), Colors.transparent],
                        ),
                      ),
                      // FittedBox(scaleDown) as a defensive safety margin
                      // for the reported bottom-overflow on some
                      // devices/content — scale factor stays 1.0 (no visual
                      // change) whenever this bar already fits, and only
                      // shrinks proportionally, never clips, on the rare
                      // combination of a very short video area and a long
                      // quality/speed label that would otherwise overflow.
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Scrubber with buffered range
                          SizedBox(
                            height: 20,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                Container(
                                  height: 3,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.25),
                                    borderRadius: BorderRadius.circular(2),
                                  ),
                                ),
                                FractionallySizedBox(
                                  alignment: Alignment.centerLeft,
                                  widthFactor: _bufferedFraction(),
                                  child: Container(
                                    height: 3,
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.45),
                                      borderRadius: BorderRadius.circular(2),
                                    ),
                                  ),
                                ),
                                SliderTheme(
                                  data: SliderThemeData(
                                    trackHeight: 3,
                                    trackShape: const _TransparentTrackShape(),
                                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
                                    overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                                    activeTrackColor: AppColors.brandOrange,
                                    inactiveTrackColor: Colors.transparent,
                                    thumbColor: Colors.white,
                                  ),
                                  child: Slider(
                                    value: progress,
                                    onChanged: duration == Duration.zero
                                        ? null
                                        : (v) {
                                            _showControlsBriefly();
                                            widget.controller.seekTo(Duration(milliseconds: (v * duration.inMilliseconds).round()));
                                          },
                                    onChangeEnd: (_) => _scheduleAutoHide(),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Row(
                            children: [
                              GestureDetector(
                                onTap: _togglePlayPause,
                                child: Icon(value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded, color: Colors.white, size: 22),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                '${_fmt(position)} / ${_fmt(duration)}',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                              ),
                              const Spacer(),
                              if (widget.captionLanguages.isNotEmpty) ...[
                                GestureDetector(
                                  onTap: _showCaptionsMenu,
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 6),
                                    child: Icon(
                                      widget.selectedCaptionLang != null
                                          ? Icons.closed_caption
                                          : Icons.closed_caption_outlined,
                                      color: widget.selectedCaptionLang != null ? AppColors.brandOrange : Colors.white,
                                      size: 19,
                                    ),
                                  ),
                                ),
                              ],
                              GestureDetector(
                                onTap: _showQualityMenu,
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 6),
                                  // The full descriptive label ("1080p (Full
                                  // HD)") is what the bottom-sheet menu shows
                                  // and what state/equality checks compare
                                  // against — this compact bar just needs the
                                  // short form so it doesn't crowd out the
                                  // speed/fullscreen controls next to it.
                                  child: Text(_qualityChipLabel(widget.qualityLabel), style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
                                ),
                              ),
                              const SizedBox(width: 6),
                              GestureDetector(
                                onTap: _showSpeedMenu,
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 6),
                                  child: Text(
                                    _playbackSpeed == 1.0 ? '1x' : '${_speedLabel(_playbackSpeed)}x',
                                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800),
                                  ),
                                ),
                              ),
                              if (widget.pipSupported && widget.onPipTapped != null) ...[
                                const SizedBox(width: 6),
                                GestureDetector(
                                  onTap: () {
                                    _showControlsBriefly();
                                    widget.onPipTapped!();
                                  },
                                  child: const Icon(
                                    Icons.picture_in_picture_alt_rounded,
                                    color: Colors.white,
                                    size: 19,
                                  ),
                                ),
                              ],
                              const SizedBox(width: 8),
                              GestureDetector(
                                onTap: widget.onToggleFullscreen,
                                child: Icon(
                                  widget.isFullscreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
                                  color: Colors.white,
                                  size: 20,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  ),
                ],
              ],
            ),
        );
      },
    );
  }
}

/// A Slider track shape with zero built-in padding on the sides, so the
/// interactive Slider lines up exactly on top of the buffered/background
/// bars drawn behind it in the Stack above (the default track shape insets
/// itself to make room for the overlay, which would otherwise misalign the
/// two).
class _TransparentTrackShape extends RoundedRectSliderTrackShape {
  const _TransparentTrackShape();

  @override
  Rect getPreferredRect({
    required RenderBox parentBox,
    Offset offset = Offset.zero,
    required SliderThemeData sliderTheme,
    bool isEnabled = false,
    bool isDiscrete = false,
  }) {
    final double trackHeight = sliderTheme.trackHeight ?? 3.0;
    final trackLeft = offset.dx;
    final trackTop = offset.dy + (parentBox.size.height - trackHeight) / 2;
    final trackWidth = parentBox.size.width;
    return Rect.fromLTWH(trackLeft, trackTop, math.max(0.0, trackWidth), trackHeight);
  }
}
