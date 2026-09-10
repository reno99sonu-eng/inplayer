import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_theme.dart';

/// Renders a high-performance geometric hexagonal honeycomb tessellation in the
/// background.
///
/// Dark Theme:
///   Obsidian midnight base with warm brand-amber honeycomb lines and luminous
///   vertex accent nodes.
///
/// Light Theme:
///   Parchment cream base with warm golden-amber honeycomb lines and amber nodes.
class PatternBackground extends StatelessWidget {
  final Widget child;
  final bool transparent;

  const PatternBackground({super.key, required this.child, this.transparent = false});

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    return CustomPaint(
      painter: _HoneycombHexagonPainter(isDark: isDark, transparent: transparent),
      child: child,
    );
  }
}

class _HoneycombHexagonPainter extends CustomPainter {
  final bool isDark;
  final bool transparent;

  const _HoneycombHexagonPainter({required this.isDark, this.transparent = false});

  @override
  void paint(Canvas canvas, Size size) {
    // 1. Draw base background and subtle ambient radial glow if not transparent
    if (!transparent) {
      final bgPaint = Paint()
        ..color = isDark ? AppColors.backgroundDark : AppColors.backgroundLight;
      canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);

      final glowPaint = Paint()
        ..shader = RadialGradient(
          center: const Alignment(0.0, -0.4),
          radius: 1.2,
          colors: isDark
              ? const [
                  Color.fromRGBO(255, 122, 24, 0.05),
                  Color.fromRGBO(255, 122, 24, 0.015),
                  Colors.transparent,
                ]
              : const [
                  Color.fromRGBO(255, 215, 120, 0.06),
                  Color.fromRGBO(255, 180, 50, 0.02),
                  Colors.transparent,
                ],
          stops: const [0.0, 0.45, 1.0],
        ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
      canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), glowPaint);
    }

    // 2. Geometry calculations for pointy-topped regular hexagons
    const double hexRadius = 26.0;
    const double halfRadius = hexRadius * 0.5;
    // sqrt(3) / 2 * 26.0 ~= 22.51666
    const double halfW = 22.516660498395403;
    const double dx = halfW * 2.0; // ~= 45.03332
    const double dy = 1.5 * hexRadius; // 39.0

    final hexPath = Path();
    final List<Offset> vertices = [];

    final int startRow = -1;
    final int endRow = (size.height / dy).ceil() + 2;
    final int startCol = -1;
    final int endCol = (size.width / dx).ceil() + 2;

    for (int r = startRow; r <= endRow; r++) {
      final double yc = r * dy;
      final double rowOffset = (r % 2 != 0) ? halfW : 0.0;

      for (int c = startCol; c <= endCol; c++) {
        final double xc = c * dx + rowOffset;

        // 3 non-overlapping edges per cell (V0 -> V1 -> V2 -> V3)
        // This covers every edge in the hexagonal lattice exactly once with zero stroke-doubling.
        hexPath.moveTo(xc, yc - hexRadius);
        hexPath.lineTo(xc + halfW, yc - halfRadius);
        hexPath.lineTo(xc + halfW, yc + halfRadius);
        hexPath.lineTo(xc, yc + hexRadius);

        // Collect unique vertex nodes (V0 = top, V3 = bottom)
        vertices.add(Offset(xc, yc - hexRadius));
        vertices.add(Offset(xc, yc + hexRadius));
      }
    }

    // 3. Draw honeycomb mesh
    final linePaint = Paint()
      ..color = isDark
          ? const Color.fromRGBO(255, 130, 35, 0.085)
          : const Color.fromRGBO(180, 110, 25, 0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(hexPath, linePaint);

    // 4. Draw vertex nodes
    final vertexPaint = Paint()
      ..color = isDark
          ? const Color.fromRGBO(255, 154, 0, 0.16)
          : const Color.fromRGBO(180, 110, 25, 0.20)
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round;

    canvas.drawPoints(ui.PointMode.points, vertices, vertexPaint);
  }

  @override
  bool shouldRepaint(covariant _HoneycombHexagonPainter oldDelegate) =>
      oldDelegate.isDark != isDark || oldDelegate.transparent != transparent;
}
