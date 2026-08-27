import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

class GoogleSignInButton extends StatefulWidget {
  final VoidCallback onPressed;
  final bool isLoading;

  const GoogleSignInButton({
    super.key,
    required this.onPressed,
    this.isLoading = false,
  });

  @override
  State<GoogleSignInButton> createState() => _GoogleSignInButtonState();
}

class _GoogleSignInButtonState extends State<GoogleSignInButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;

    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) {
        setState(() => _isPressed = false);
        if (!widget.isLoading) widget.onPressed();
      },
      onTapCancel: () => setState(() => _isPressed = false),
      child: AnimatedScale(
        scale: _isPressed ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withValues(alpha: 0.06)
                : Colors.black.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.14)
                  : Colors.black.withValues(alpha: 0.12),
              width: 1,
            ),
          ),
          child: Center(
            child: widget.isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.brandOrange,
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const _GoogleLogoG(size: 20),
                      const SizedBox(width: 12),
                      Text(
                        'Continue with Google',
                        style: TextStyle(
                          color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF1E293B),
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _GoogleLogoG extends StatelessWidget {
  final double size;

  const _GoogleLogoG({this.size = 20});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _GoogleLogoPainter(),
      ),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;

    // Standard Google 4-color 'G'
    final paint = Paint()
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    final center = Offset(w / 2, h / 2);
    final radius = w / 2;
    final innerRadius = radius * 0.58;

    // Blue Path: horizontal bar from center to right edge, and bottom-right wedge
    final bluePath = Path()
      ..moveTo(center.dx, center.dy - radius * 0.22)
      ..lineTo(w, center.dy - radius * 0.22)
      ..arcTo(
        Rect.fromCircle(center: center, radius: radius),
        0.0,
        1.15,
        false,
      )
      ..lineTo(
        center.dx + innerRadius * 0.7,
        center.dy + innerRadius * 0.7,
      )
      ..arcTo(
        Rect.fromCircle(center: center, radius: innerRadius),
        0.8,
        -0.8,
        false,
      )
      ..lineTo(center.dx, center.dy + radius * 0.22)
      ..close();
    paint.color = const Color(0xFF4285F4);
    canvas.drawPath(bluePath, paint);

    // Green Path: bottom arc
    final greenPath = Path()
      ..arcTo(
        Rect.fromCircle(center: center, radius: radius),
        0.65,
        1.55,
        false,
      )
      ..arcTo(
        Rect.fromCircle(center: center, radius: innerRadius),
        2.2,
        -1.55,
        false,
      )
      ..close();
    paint.color = const Color(0xFF34A853);
    canvas.drawPath(greenPath, paint);

    // Yellow Path: left arc
    final yellowPath = Path()
      ..arcTo(
        Rect.fromCircle(center: center, radius: radius),
        2.1,
        1.25,
        false,
      )
      ..arcTo(
        Rect.fromCircle(center: center, radius: innerRadius),
        3.35,
        -1.25,
        false,
      )
      ..close();
    paint.color = const Color(0xFFFBBC05);
    canvas.drawPath(yellowPath, paint);

    // Red Path: top arc
    final redPath = Path()
      ..arcTo(
        Rect.fromCircle(center: center, radius: radius),
        3.25,
        1.85,
        false,
      )
      ..arcTo(
        Rect.fromCircle(center: center, radius: innerRadius),
        5.1,
        -1.85,
        false,
      )
      ..close();
    paint.color = const Color(0xFFEA4335);
    canvas.drawPath(redPath, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
