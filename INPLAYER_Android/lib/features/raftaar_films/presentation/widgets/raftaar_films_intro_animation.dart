import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';

/// Full-screen Liquid Glass 3D animated intro for Raftaar Films.
/// Shows for ~2.5 seconds then calls [onComplete].
class RaftaarFilmsIntroAnimation extends StatefulWidget {
  final VoidCallback onComplete;
  const RaftaarFilmsIntroAnimation({super.key, required this.onComplete});

  @override
  State<RaftaarFilmsIntroAnimation> createState() =>
      _RaftaarFilmsIntroAnimationState();
}

class _RaftaarFilmsIntroAnimationState extends State<RaftaarFilmsIntroAnimation>
    with TickerProviderStateMixin {
  late AnimationController _entryCtrl;
  late AnimationController _floatCtrl;
  late AnimationController _exitCtrl;
  late AnimationController _pulseCtrl;

  late Animation<double> _cardOpacity;
  late Animation<double> _cardScale;
  late Animation<double> _cardTiltX;
  late Animation<double> _cardTiltY;
  late Animation<double> _subtitleSlide;
  late Animation<double> _exitOpacity;
  late Animation<double> _pulseScale;
  late Animation<double> _shimmerSweep;

  @override
  void initState() {
    super.initState();

    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    _floatCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3200),
    )..repeat(reverse: true);
    _exitCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    )..repeat(reverse: true);

    _cardOpacity = Tween(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _entryCtrl,
        curve: const Interval(0.0, 0.45, curve: Curves.easeOut),
      ),
    );
    _cardScale = Tween(begin: 0.82, end: 1.0).animate(
      CurvedAnimation(
        parent: _entryCtrl,
        curve: const Interval(0.0, 0.7, curve: Curves.easeOutBack),
      ),
    );
    _cardTiltX = Tween(begin: 0.8, end: 0.0).animate(
      CurvedAnimation(
        parent: _entryCtrl,
        curve: const Interval(0.0, 0.8, curve: Curves.easeOutCubic),
      ),
    );
    _cardTiltY = Tween(begin: -0.5, end: 0.0).animate(
      CurvedAnimation(
        parent: _entryCtrl,
        curve: const Interval(0.0, 0.8, curve: Curves.easeOutCubic),
      ),
    );

    _subtitleSlide = Tween(begin: 24.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _entryCtrl,
        curve: const Interval(0.5, 0.95, curve: Curves.easeOut),
      ),
    );

    _shimmerSweep = Tween(begin: -1.2, end: 1.8).animate(
      CurvedAnimation(parent: _floatCtrl, curve: Curves.easeInOut),
    );

    _exitOpacity = Tween(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _exitCtrl, curve: Curves.easeInOut),
    );

    _pulseScale = Tween(begin: 1.0, end: 1.18).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    _runSequence();
  }

  Future<void> _runSequence() async {
    await _entryCtrl.forward();
    await Future.delayed(const Duration(milliseconds: 1400));
    if (mounted) {
      await _exitCtrl.forward();
      widget.onComplete();
    }
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    _floatCtrl.dispose();
    _exitCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_entryCtrl, _floatCtrl, _exitCtrl, _pulseCtrl]),
      builder: (context, _) {
        final floatY = math.sin(_floatCtrl.value * math.pi) * 8.0;
        final floatTiltX = math.sin(_floatCtrl.value * math.pi) * 0.04;
        final floatTiltY = math.cos(_floatCtrl.value * math.pi) * 0.05;

        final currentTiltX = _cardTiltX.value * 0.7 + floatTiltX;
        final currentTiltY = _cardTiltY.value * 0.7 + floatTiltY;

        return Opacity(
          opacity: _exitOpacity.value,
          child: Container(
            color: const Color(0xFF070811),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Floating Liquid Gradient Orb 1 (Orange/Amber)
                Positioned(
                  top: -80,
                  left: -60,
                  child: ScaleTransition(
                    scale: _pulseScale,
                    child: Container(
                      width: 440,
                      height: 440,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            const Color(0xFFFF7A18).withValues(alpha: 0.42),
                            const Color(0xFFFF3D00).withValues(alpha: 0.18),
                            Colors.transparent,
                          ],
                          stops: const [0.0, 0.5, 0.8],
                        ),
                      ),
                    ),
                  ),
                ),

                // Floating Liquid Gradient Orb 2 (Crimson/Deep Flame)
                Positioned(
                  bottom: -60,
                  right: -50,
                  child: ScaleTransition(
                    scale: _pulseScale,
                    child: Container(
                      width: 400,
                      height: 400,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            const Color(0xFFFF9A00).withValues(alpha: 0.35),
                            const Color(0xFFFF2D55).withValues(alpha: 0.16),
                            Colors.transparent,
                          ],
                          stops: const [0.0, 0.45, 0.8],
                        ),
                      ),
                    ),
                  ),
                ),

                // Floating Liquid Gradient Orb 3 (Golden Core Glow)
                Positioned(
                  child: Container(
                    width: 280,
                    height: 280,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          const Color(0xFFFFD700).withValues(alpha: 0.22),
                          Colors.transparent,
                        ],
                        stops: const [0.0, 0.7],
                      ),
                    ),
                  ),
                ),

                // Central 3D Liquid Frosted Glass Shield
                Opacity(
                  opacity: _cardOpacity.value,
                  child: Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, 0.0014) // 3D Perspective
                      ..rotateX(currentTiltX)
                      ..rotateY(currentTiltY)
                      ..translate(0.0, floatY, 25.0)
                      ..scale(_cardScale.value),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(32),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 36,
                            vertical: 38,
                          ),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                Colors.white.withValues(alpha: 0.15),
                                Colors.white.withValues(alpha: 0.03),
                                Colors.black.withValues(alpha: 0.45),
                              ],
                              stops: const [0.0, 0.55, 1.0],
                            ),
                            borderRadius: BorderRadius.circular(32),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.24),
                              width: 1.5,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.85),
                                blurRadius: 40,
                                offset: const Offset(0, 20),
                              ),
                              BoxShadow(
                                color: const Color(0xFFFF7A18).withValues(alpha: 0.35),
                                blurRadius: 50,
                                spreadRadius: -5,
                              ),
                            ],
                          ),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // Liquid Shimmer Light Sweep
                              Positioned.fill(
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(30),
                                  child: Transform.translate(
                                    offset: Offset(_shimmerSweep.value * 200, 0),
                                    child: Transform.rotate(
                                      angle: -0.35,
                                      child: Container(
                                        width: 80,
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [
                                              Colors.transparent,
                                              Colors.white.withValues(alpha: 0.25),
                                              Colors.white.withValues(alpha: 0.45),
                                              Colors.white.withValues(alpha: 0.25),
                                              Colors.transparent,
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),

                              // Inner Content: Logo, Badge & Waves
                              Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  // Film Emblem
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      gradient: const LinearGradient(
                                        colors: [Color(0xFFFF7A18), Color(0xFFFF3D00)],
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: const Color(0xFFFF7A18).withValues(alpha: 0.5),
                                          blurRadius: 18,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    child: const Icon(
                                      Icons.movie_filter_rounded,
                                      color: Colors.white,
                                      size: 26,
                                    ),
                                  ),

                                  const SizedBox(height: 16),

                                  // 3D Molten Typography
                                  ShaderMask(
                                    shaderCallback: (bounds) => const LinearGradient(
                                      colors: [
                                        Color(0xFFFF7A18),
                                        Color(0xFFFFD700),
                                        Color(0xFFFF3D00),
                                        Color(0xFFFFA000),
                                      ],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ).createShader(bounds),
                                    blendMode: BlendMode.srcIn,
                                    child: const Text(
                                      'Raftaar Films',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 38,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: -1.5,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),

                                  const SizedBox(height: 12),

                                  // Subtitle Capsule with Glowing Amber Dot
                                  Transform.translate(
                                    offset: Offset(0, _subtitleSlide.value),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(alpha: 0.08),
                                        borderRadius: BorderRadius.circular(20),
                                        border: Border.all(
                                          color: Colors.white.withValues(alpha: 0.16),
                                          width: 1,
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Container(
                                            width: 6,
                                            height: 6,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: const Color(0xFFFF7A18),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: const Color(0xFFFF7A18).withValues(alpha: 0.8),
                                                  blurRadius: 8,
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            'BY INPLAYER',
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              letterSpacing: 4,
                                              color: Colors.white.withValues(alpha: 0.85),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),

                                  const SizedBox(height: 18),

                                  // Rhythm Equalizer Wave Bars
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: List.generate(7, (i) {
                                      final waveHeight = 6.0 +
                                          math.sin((_floatCtrl.value * 2 * math.pi) + (i * 0.8)).abs() * 16.0;
                                      return Container(
                                        margin: const EdgeInsets.symmetric(horizontal: 2.5),
                                        width: 3,
                                        height: waveHeight,
                                        decoration: BoxDecoration(
                                          gradient: const LinearGradient(
                                            colors: [Color(0xFFFFA000), Color(0xFFFF3D00)],
                                            begin: Alignment.topCenter,
                                            end: Alignment.bottomCenter,
                                          ),
                                          borderRadius: BorderRadius.circular(2),
                                          boxShadow: [
                                            BoxShadow(
                                              color: const Color(0xFFFF7A18).withValues(alpha: 0.4),
                                              blurRadius: 6,
                                            ),
                                          ],
                                        ),
                                      );
                                    }),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
