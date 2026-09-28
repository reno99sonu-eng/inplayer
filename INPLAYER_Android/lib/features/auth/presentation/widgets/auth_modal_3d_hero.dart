import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// Animated InPlayer emblem used by the sign-in and account-creation panels.
/// The perspective transforms and layered orbital rings are native Flutter
/// effects so the design stays crisp and interactive on every screen density.
class AuthModal3DHero extends StatefulWidget {
  final bool isDark;

  const AuthModal3DHero({super.key, required this.isDark});

  @override
  State<AuthModal3DHero> createState() => _AuthModal3DHeroState();
}

class _AuthModal3DHeroState extends State<AuthModal3DHero>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 7200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: SizedBox(
        height: 132,
        width: double.infinity,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final phase = _controller.value * math.pi * 2;
            final bob = math.sin(phase) * 4;
            final tilt = math.sin(phase * .72);
            final glow = .18 + ((math.sin(phase) + 1) * .10);
            final cardTransform = Matrix4.identity()
              ..setEntry(3, 2, .0018)
              ..rotateX(tilt * .18)
              ..rotateY(math.sin(phase) * .38)
              ..rotateZ(math.sin(phase * .5) * .06);
            final orbitalTransform = Matrix4.identity()
              ..setEntry(3, 2, .001)
              ..rotateX(.92 + math.sin(phase * .42) * .07)
              ..rotateZ(phase * .16);

            return Stack(
              alignment: Alignment.center,
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 142,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        AppColors.brandOrange.withValues(alpha: glow),
                        const Color(0xFF18B7A5).withValues(alpha: glow * .35),
                        Colors.transparent,
                      ],
                      stops: const [0, .48, 1],
                    ),
                  ),
                ),
                Transform(
                  alignment: Alignment.center,
                  transform: orbitalTransform,
                  child: Container(
                    width: 158,
                    height: 62,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(50),
                      border: Border.all(
                        color: AppColors.brandOrange.withValues(alpha: .7),
                        width: 1.4,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.brandOrange.withValues(alpha: .18),
                          blurRadius: 20,
                        ),
                      ],
                    ),
                  ),
                ),
                Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.identity()
                    ..setEntry(3, 2, .001)
                    ..rotateX(-.55)
                    ..rotateZ(-phase * .2),
                  child: Container(
                    width: 108,
                    height: 42,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(50),
                      border: Border.all(
                        color: const Color(0xFF7DE7D2).withValues(alpha: .62),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF33D8C0).withValues(alpha: .17),
                          blurRadius: 16,
                        ),
                      ],
                    ),
                  ),
                ),
                Transform.translate(
                  offset: Offset(0, bob),
                  child: Transform(
                    alignment: Alignment.center,
                    transform: cardTransform,
                    child: Container(
                      width: 72,
                      height: 72,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(23),
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            Color(0xFFFFE29A),
                            Color(0xFFFF9918),
                            Color(0xFFE94A00),
                          ],
                        ),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: .72),
                          width: 1.4,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.brandOrange.withValues(alpha: .58),
                            blurRadius: 28,
                            offset: const Offset(0, 14),
                          ),
                          BoxShadow(
                            color: Colors.black.withValues(
                              alpha: widget.isDark ? .42 : .16,
                            ),
                            blurRadius: 12,
                            offset: const Offset(0, 9),
                          ),
                        ],
                      ),
                      child: Image.asset(
                        'assets/images/logo_triangle.png',
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(
                              Icons.play_arrow_rounded,
                              color: Color(0xFF101827),
                              size: 48,
                            ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 48,
                  top: 19 + bob * .35,
                  child: _AuthHeroOrb(
                    icon: Icons.auto_awesome_rounded,
                    color: AppColors.brandOrange,
                    size: 14,
                    phase: phase,
                  ),
                ),
                Positioned(
                  right: 45,
                  bottom: 19 - bob * .35,
                  child: _AuthHeroOrb(
                    icon: Icons.bolt_rounded,
                    color: const Color(0xFF70E2CF),
                    size: 16,
                    phase: -phase * .82,
                  ),
                ),
                Positioned(
                  right: 76,
                  top: 14 - bob * .24,
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFD879),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.brandOrange.withValues(alpha: .8),
                          blurRadius: 10,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _AuthHeroOrb extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;
  final double phase;

  const _AuthHeroOrb({
    required this.icon,
    required this.color,
    required this.size,
    required this.phase,
  });

  @override
  Widget build(BuildContext context) {
    final opacity = (.55 + math.sin(phase) * .25).clamp(.25, .9);
    return Container(
      width: 29,
      height: 29,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color.withValues(alpha: .10),
        border: Border.all(color: color.withValues(alpha: opacity)),
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: .22), blurRadius: 14),
        ],
      ),
      child: Icon(icon, color: color, size: size),
    );
  }
}
