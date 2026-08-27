import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// A tiny animated 3-bar equalizer — the "currently playing" indicator
/// used throughout the Music section (track tiles, the queue sheet)
/// instead of a static icon. Bars pulse independently, at slightly
/// different speeds, while [playing] is true; they settle to a short
/// static height the moment playback pauses, so a glance tells you not
/// just *which* track is current but whether it's actually moving right
/// now. Self-contained — no external animation package, matches the
/// hand-rolled `AnimationController` style already used elsewhere in the
/// Music section (see now_playing_page.dart's sleeve glow).
class MiniEqualizer extends StatefulWidget {
  final bool playing;
  final Color color;
  final double barWidth;
  final double height;

  const MiniEqualizer({
    super.key,
    required this.playing,
    this.color = AppColors.brandOrangeLight,
    this.barWidth = 3,
    this.height = 16,
  });

  @override
  State<MiniEqualizer> createState() => _MiniEqualizerState();
}

class _MiniEqualizerState extends State<MiniEqualizer> with TickerProviderStateMixin {
  static const _durations = [
    Duration(milliseconds: 520),
    Duration(milliseconds: 680),
    Duration(milliseconds: 420),
  ];

  late final List<AnimationController> _controllers = _durations
      .map((d) => AnimationController(vsync: this, duration: d))
      .toList();

  @override
  void initState() {
    super.initState();
    if (widget.playing) _startAll();
  }

  void _startAll() {
    for (final c in _controllers) {
      c.repeat(reverse: true);
    }
  }

  void _stopAll() {
    for (final c in _controllers) {
      c.animateTo(0.0, duration: const Duration(milliseconds: 220));
    }
  }

  @override
  void didUpdateWidget(covariant MiniEqualizer old) {
    super.didUpdateWidget(old);
    if (widget.playing != old.playing) {
      widget.playing ? _startAll() : _stopAll();
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: widget.height,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(_controllers.length, (i) {
          return AnimatedBuilder(
            animation: _controllers[i],
            builder: (context, child) {
              final value = _controllers[i].value;
              final barHeight = (0.28 + value * 0.72) * widget.height;
              return Container(
                margin: EdgeInsets.only(left: i == 0 ? 0 : 2),
                width: widget.barWidth,
                height: barHeight,
                decoration: BoxDecoration(
                  color: widget.color,
                  borderRadius: BorderRadius.circular(widget.barWidth / 2),
                ),
              );
            },
          );
        }),
      ),
    );
  }
}
