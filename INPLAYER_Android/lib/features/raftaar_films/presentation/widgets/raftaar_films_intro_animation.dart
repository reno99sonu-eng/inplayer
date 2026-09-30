import 'package:flutter/material.dart';

/// High-performance Liquid Glass 3D animated intro for Raftaar Films.
/// Designed for locked 60/120 FPS on all Android devices with zero raster jank.
class RaftaarFilmsIntroAnimation extends StatefulWidget {
  final VoidCallback onComplete;
  const RaftaarFilmsIntroAnimation({super.key, required this.onComplete});

  @override
  State<RaftaarFilmsIntroAnimation> createState() =>
      _RaftaarFilmsIntroAnimationState();
}

class _RaftaarFilmsIntroAnimationState extends State<RaftaarFilmsIntroAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;

  late Animation<double> _cardOpacity;
  late Animation<double> _cardScale;
  late Animation<double> _cardTilt;
  late Animation<double> _subtitleSlide;
  late Animation<double> _exitOpacity;

  bool _isExiting = false;

  @override
  void initState() {
    super.initState();

    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1750),
    );

    // Entry (0ms - 750ms)
    _cardOpacity = Tween(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animCtrl,
        curve: const Interval(0.0, 0.4, curve: Curves.easeOut),
      ),
    );
    _cardScale = Tween(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(
        parent: _animCtrl,
        curve: const Interval(0.0, 0.5, curve: Curves.easeOutBack),
      ),
    );
    _cardTilt = Tween(begin: 0.4, end: 0.0).animate(
      CurvedAnimation(
        parent: _animCtrl,
        curve: const Interval(0.0, 0.5, curve: Curves.easeOutCubic),
      ),
    );

    // Subtitle badge rise (350ms - 700ms)
    _subtitleSlide = Tween(begin: 18.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _animCtrl,
        curve: const Interval(0.2, 0.45, curve: Curves.easeOut),
      ),
    );

    // Exit fade (1450ms - 1750ms)
    _exitOpacity = Tween(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _animCtrl,
        curve: const Interval(0.8, 1.0, curve: Curves.easeInOut),
      ),
    );

    _animCtrl.forward().then((_) {
      if (mounted && !_isExiting) {
        widget.onComplete();
      }
    });
  }

  void _skip() {
    if (_isExiting) return;
    _isExiting = true;
    _animCtrl.stop();
    widget.onComplete();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _skip,
      behavior: HitTestBehavior.opaque,
      child: AnimatedBuilder(
        animation: _animCtrl,
        builder: (context, _) {
          return Opacity(
            opacity: _exitOpacity.value,
            child: Container(
              color: const Color(0xFF070811),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Ambient Liquid Glow Orb 1 (Orange/Amber)
                  Positioned(
                    top: -60,
                    left: -40,
                    child: Container(
                      width: 380,
                      height: 380,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            const Color(0xFFFF7A18).withValues(alpha: 0.35),
                            const Color(0xFFFF3D00).withValues(alpha: 0.12),
                            Colors.transparent,
                          ],
                          stops: const [0.0, 0.5, 0.8],
                        ),
                      ),
                    ),
                  ),

                  // Ambient Liquid Glow Orb 2 (Gold/Flame)
                  Positioned(
                    bottom: -50,
                    right: -40,
                    child: Container(
                      width: 360,
                      height: 360,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            const Color(0xFFFF9A00).withValues(alpha: 0.3),
                            const Color(0xFFFF2D55).withValues(alpha: 0.1),
                            Colors.transparent,
                          ],
                          stops: const [0.0, 0.5, 0.8],
                        ),
                      ),
                    ),
                  ),

                  // Center 3D Liquid Frosted Glass Shield
                  Opacity(
                    opacity: _cardOpacity.value,
                    child: Transform(
                      alignment: Alignment.center,
                      transform: Matrix4.identity()
                        ..setEntry(3, 2, 0.0012)
                        ..rotateX(_cardTilt.value)
                        ..scale(_cardScale.value),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 36,
                          vertical: 36,
                        ),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Colors.white.withValues(alpha: 0.15),
                              Colors.white.withValues(alpha: 0.04),
                              Colors.black.withValues(alpha: 0.55),
                            ],
                            stops: const [0.0, 0.5, 1.0],
                          ),
                          borderRadius: BorderRadius.circular(30),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.22),
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.7),
                              blurRadius: 30,
                              offset: const Offset(0, 15),
                            ),
                            BoxShadow(
                              color: const Color(0xFFFF7A18).withValues(alpha: 0.25),
                              blurRadius: 35,
                              spreadRadius: -4,
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Film Emblem Icon
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
                                    color: const Color(0xFFFF7A18).withValues(alpha: 0.45),
                                    blurRadius: 16,
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
                                  letterSpacing: -1.2,
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

                            const SizedBox(height: 16),

                            // Sound/Film Wave Bars
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [8.0, 14.0, 22.0, 16.0, 24.0, 12.0, 7.0].map((h) {
                                return Container(
                                  margin: const EdgeInsets.symmetric(horizontal: 2.5),
                                  width: 3,
                                  height: h,
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFFFFA000), Color(0xFFFF3D00)],
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                    ),
                                    borderRadius: BorderRadius.circular(2),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFFFF7A18).withValues(alpha: 0.35),
                                        blurRadius: 4,
                                      ),
                                    ],
                                  ),
                                );
                              }).toList(),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
