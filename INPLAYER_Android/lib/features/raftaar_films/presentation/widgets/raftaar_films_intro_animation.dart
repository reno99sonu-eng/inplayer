import 'package:flutter/material.dart';

/// Full-screen 3D-style animated intro for Raftaar Films.
/// Shows for ~2.5 seconds then calls [onComplete].
class RaftaarFilmsIntroAnimation extends StatefulWidget {
  final VoidCallback onComplete;
  const RaftaarFilmsIntroAnimation({super.key, required this.onComplete});

  @override
  State<RaftaarFilmsIntroAnimation> createState() => _RaftaarFilmsIntroAnimationState();
}

class _RaftaarFilmsIntroAnimationState extends State<RaftaarFilmsIntroAnimation>
    with TickerProviderStateMixin {
  late AnimationController _logoCtrl;
  late AnimationController _subtitleCtrl;
  late AnimationController _exitCtrl;
  late AnimationController _pulseCtrl;

  late Animation<double> _logoOpacity;
  late Animation<double> _logoTilt; // simulates 3D rotateX via perspective matrix
  late Animation<double> _subtitleOpacity;
  late Animation<double> _subtitleSlide;
  late Animation<double> _exitOpacity;
  late Animation<double> _pulseScale;

  @override
  void initState() {
    super.initState();

    _logoCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _subtitleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _exitCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    )..repeat(reverse: true);

    _logoOpacity = Tween(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _logoCtrl, curve: const Interval(0.0, 0.5, curve: Curves.easeOut)),
    );
    _logoTilt = Tween(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _logoCtrl, curve: Curves.elasticOut),
    ); // 1.0 = tilted, 0.0 = flat

    _subtitleOpacity = Tween(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _subtitleCtrl, curve: Curves.easeOut),
    );
    _subtitleSlide = Tween(begin: 20.0, end: 0.0).animate(
      CurvedAnimation(parent: _subtitleCtrl, curve: Curves.easeOut),
    );

    _exitOpacity = Tween(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _exitCtrl, curve: Curves.easeInOut),
    );

    _pulseScale = Tween(begin: 1.0, end: 1.12).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    _runSequence();
  }

  Future<void> _runSequence() async {
    await _logoCtrl.forward();
    await Future.delayed(const Duration(milliseconds: 200));
    await _subtitleCtrl.forward();
    await Future.delayed(const Duration(milliseconds: 1200));
    await _exitCtrl.forward();
    widget.onComplete();
  }

  @override
  void dispose() {
    _logoCtrl.dispose();
    _subtitleCtrl.dispose();
    _exitCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_logoCtrl, _subtitleCtrl, _exitCtrl, _pulseCtrl]),
      builder: (context, _) {
        return Opacity(
          opacity: _exitOpacity.value,
          child: Container(
            color: const Color(0xFF08080F),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Ambient glow orbs
                Positioned(
                  top: -100,
                  left: -100,
                  child: ScaleTransition(
                    scale: _pulseScale,
                    child: Container(
                      width: 400,
                      height: 400,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            const Color(0xFFFF7A18).withValues(alpha: 0.3),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  bottom: -80,
                  right: -80,
                  child: ScaleTransition(
                    scale: _pulseScale,
                    child: Container(
                      width: 350,
                      height: 350,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            const Color(0xFFFF4500).withValues(alpha: 0.25),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

                // Main logo + subtitle
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // 3D-effect logo (perspective transform via Transform)
                    Opacity(
                      opacity: _logoOpacity.value,
                      child: Transform(
                        alignment: Alignment.center,
                        transform: Matrix4.identity()
                          ..setEntry(3, 2, 0.001) // perspective
                          ..rotateX(_logoTilt.value * 1.57), // π/2 radians when tilted
                        child: ShaderMask(
                          shaderCallback: (bounds) => const LinearGradient(
                            colors: [
                              Color(0xFFFF7A18),
                              Color(0xFFFFD700),
                              Color(0xFFFF4500),
                              Color(0xFFFF9A00),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ).createShader(bounds),
                          blendMode: BlendMode.srcIn,
                          child: const Text(
                            'Raftaar Films',
                            style: TextStyle(
                              fontSize: 42,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -1.5,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Subtitle
                    Opacity(
                      opacity: _subtitleOpacity.value,
                      child: Transform.translate(
                        offset: Offset(0, _subtitleSlide.value),
                        child: Text(
                          'BY INPLAYER',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 5,
                            color: Colors.white.withValues(alpha: 0.5),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Decorative line
                    Opacity(
                      opacity: _subtitleOpacity.value,
                      child: Container(
                        width: 80,
                        height: 2,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Colors.transparent, Color(0xFFFF7A18), Colors.transparent],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
