import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_theme.dart';

/// The web app renders a subtle amber dot honeycomb grid over the warm
/// parchment background on light-themed screens (Home, Channel, Shop),
/// and an obsidian grid on dark screens.
///
/// CSS reference:
///   radial-gradient(circle at 24px 24px, rgba(200,130,35,0.16) 2px, transparent 2px)
///   background-size: 46px 46px
class PatternBackground extends StatelessWidget {
  final Widget child;
  final bool transparent;

  const PatternBackground({super.key, required this.child, this.transparent = false});

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    return CustomPaint(
      painter: _HoneycombDotPainter(isDark: isDark, transparent: transparent),
      child: child,
    );
  }
}

class _HoneycombDotPainter extends CustomPainter {
  final bool isDark;
  final bool transparent;
  const _HoneycombDotPainter({required this.isDark, this.transparent = false});

  @override
  void paint(Canvas canvas, Size size) {
    if (!transparent) {
      final bgPaint = Paint()
        ..color = isDark ? AppColors.backgroundDark : AppColors.backgroundLight;
      canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);
    }

    // Draw the amber dot grid (matches web CSS radial-gradient)
    final dotPaint = Paint()
      ..color = isDark
          ? const Color.fromRGBO(200, 130, 35, 0.08)
          : const Color.fromRGBO(200, 130, 35, 0.16)
      ..style = PaintingStyle.fill;

    const double gridSize = 46.0;
    const double dotRadius = 2.0;
    const double offsetX = 24.0;
    const double offsetY = 24.0;

    for (double y = offsetY; y < size.height; y += gridSize) {
      for (double x = offsetX; x < size.width; x += gridSize) {
        canvas.drawCircle(Offset(x, y), dotRadius, dotPaint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _HoneycombDotPainter oldDelegate) =>
      oldDelegate.isDark != isDark;
}
