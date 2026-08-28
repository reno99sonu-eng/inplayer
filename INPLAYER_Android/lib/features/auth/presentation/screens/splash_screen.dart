import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/geo_service.dart';

class SplashScreenOverlay extends ConsumerStatefulWidget {
  final VoidCallback? onDismiss;

  const SplashScreenOverlay({super.key, this.onDismiss});

  @override
  ConsumerState<SplashScreenOverlay> createState() => _SplashScreenOverlayState();
}

class _SplashScreenOverlayState extends ConsumerState<SplashScreenOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _masterController;

  late Animation<double> _logoScale;
  late Animation<double> _logoOpacity;
  late Animation<double> _logoTilt;
  late Animation<double> _flashOpacity;
  late Animation<double> _shinePosition;
  late Animation<double> _taglineOpacity;
  late Animation<double> _greetingOpacity;
  late Animation<double> _curtainOpacity;

  AudioPlayer? _audioPlayer;
  Timer? _fallbackTimer;
  bool _isVisible = true;
  String? _cachedUserName;

  @override
  void initState() {
    super.initState();
    _loadCachedName();

    _masterController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    );

    // 1. Logo Zoom & Tilt (0% -> 45%)
    _logoScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 0.70, end: 1.06).chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 75,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 1.06, end: 1.00).chain(CurveTween(curve: Curves.easeInOut)),
        weight: 25,
      ),
    ]).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.00, 0.45, curve: Curves.linear),
      ),
    );

    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.00, 0.25, curve: Curves.easeIn),
      ),
    );

    _logoTilt = Tween<double>(begin: 0.12, end: 0.0).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.00, 0.40, curve: Curves.easeOutCubic),
      ),
    );

    // 2. Flash Burst (12% -> 35%)
    _flashOpacity = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: 0.90).chain(CurveTween(curve: Curves.easeInQuad)),
        weight: 35,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 0.90, end: 0.0).chain(CurveTween(curve: Curves.easeOutQuad)),
        weight: 65,
      ),
    ]).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.10, 0.38, curve: Curves.linear),
      ),
    );

    // 3. Diagonal Light Shine Sweep (32% -> 66%)
    _shinePosition = Tween<double>(begin: -1.2, end: 1.5).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.30, 0.66, curve: Curves.easeInOutCubic),
      ),
    );

    // 4. Tagline & Greeting Fade In (45% -> 80%)
    _taglineOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.42, 0.68, curve: Curves.easeOut),
      ),
    );

    _greetingOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.55, 0.80, curve: Curves.easeOut),
      ),
    );

    // 5. Smooth Exit Curtain (86% -> 100%)
    _curtainOpacity = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.86, 1.00, curve: Curves.easeInOutCubic),
      ),
    );

    _initAudioAndPlay();
    _triggerGeoCheck();
  }

  void _triggerGeoCheck() {
    ref.read(geoServiceProvider).verifyGeo().then((result) {
      if (!result.allowed) {
        debugPrint('[InPlayer] Geo verification restriction flagged: ${result.country}');
      }
    }).catchError((_) {});
  }

  void _dismissSplash() {
    if (_isVisible && mounted) {
      _fallbackTimer?.cancel();
      setState(() => _isVisible = false);
      widget.onDismiss?.call();
    }
  }

  void _initAudioAndPlay() {
    _fallbackTimer = Timer(const Duration(milliseconds: 3800), _dismissSplash);

    try {
      _audioPlayer = AudioPlayer();
      _audioPlayer!.setVolume(1.0);
      _audioPlayer!.play(AssetSource('sounds/splash-logo-sting.mp3')).catchError((_) {});
    } catch (_) {}

    _masterController.forward().then((_) {
      _dismissSplash();
    });
  }

  Future<void> _loadCachedName() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      var name = prefs.getString('inplayer:cached_user_name');
      if (name == null || name.isEmpty) name = prefs.getString('inplayer:user_name');
      if (name == null || name.isEmpty) name = prefs.getString('user_name');
      if (name == null || name.isEmpty) name = prefs.getString('username');
      if (name != null && name.isNotEmpty && mounted) {
        setState(() => _cachedUserName = name);
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _fallbackTimer?.cancel();
    _masterController.dispose();
    _audioPlayer?.dispose();
    super.dispose();
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  @override
  Widget build(BuildContext context) {
    if (!_isVisible) return const SizedBox.shrink();

    final isDark = context.isDark;
    final authState = ref.watch(authStateProvider);
    final user = authState is AuthStateAuthenticated ? authState.user : null;

    if (user != null && user.name.isNotEmpty && _cachedUserName != user.name) {
      _cachedUserName = user.name;
      SharedPreferences.getInstance().then((p) => p.setString('inplayer:cached_user_name', user.name));
    }

    final effectiveName = (user != null && user.name.isNotEmpty)
        ? user.name
        : (user != null && user.username.isNotEmpty)
            ? user.username
            : (_cachedUserName ?? '');

    final timeGreeting = _getGreeting();
    final greeting = effectiveName.isNotEmpty
        ? '$timeGreeting, $effectiveName'
        : timeGreeting;

    return AnimatedBuilder(
      animation: _masterController,
      builder: (context, child) {
        final curtainVal = _curtainOpacity.value;
        if (curtainVal <= 0.0) return const SizedBox.shrink();

        return Opacity(
          opacity: curtainVal.clamp(0.0, 1.0),
          child: child,
        );
      },
      child: Material(
        color: isDark ? const Color(0xFF030712) : const Color(0xFFFAF6EE),
        child: Stack(
          alignment: Alignment.center,
          children: [
            // 1. Peacock Feather Background
            Positioned.fill(
              child: AnimatedBuilder(
                animation: _masterController,
                builder: (context, _) {
                  return CustomPaint(
                    painter: PeacockFeatherPainter(
                      animationProgress: _masterController.value,
                      isDark: isDark,
                    ),
                  );
                },
              ),
            ),

            // 2. Flash Burst Wash
            AnimatedBuilder(
              animation: _flashOpacity,
              builder: (context, child) {
                final flashVal = _flashOpacity.value;
                if (flashVal <= 0.01) return const SizedBox.shrink();
                return Opacity(
                  opacity: flashVal.clamp(0.0, 1.0),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: Alignment.center,
                        radius: 0.75,
                        colors: [
                          Colors.white.withValues(alpha: 0.92),
                          const Color(0xFFFFA600).withValues(alpha: 0.60),
                          const Color(0xFFFFA600).withValues(alpha: 0.0),
                        ],
                        stops: const [0.0, 0.35, 0.70],
                      ),
                    ),
                  ),
                );
              },
            ),

            // 3. Centered Logo & Content
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // 3D Logo with Diagonal Shine Sweep
                    AnimatedBuilder(
                      animation: _masterController,
                      builder: (context, child) {
                        final scale = _logoScale.value;
                        final tilt = _logoTilt.value;
                        final opacity = _logoOpacity.value.clamp(0.0, 1.0);

                        return Transform.scale(
                          scale: scale,
                          child: Transform(
                            alignment: Alignment.center,
                            transform: Matrix4.identity()
                              ..setEntry(3, 2, 0.001)
                              ..rotateX(tilt),
                            child: Opacity(
                              opacity: opacity,
                              child: child,
                            ),
                          ),
                        );
                      },
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.brandOrange.withValues(alpha: isDark ? 0.40 : 0.20),
                              blurRadius: 36,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // InPlayer Wordmark Image
                              Image.asset(
                                isDark
                                    ? 'assets/images/inplayer-mark-dark.png'
                                    : 'assets/images/inplayer-mark-light.png',
                                height: 76,
                                fit: BoxFit.contain,
                              ),

                              // Diagonal Light-Shine Sweep
                              Positioned.fill(
                                child: AnimatedBuilder(
                                  animation: _shinePosition,
                                  builder: (context, child) {
                                    return FractionallySizedBox(
                                      alignment: Alignment(_shinePosition.value, 0.0),
                                      widthFactor: 0.5,
                                      child: Transform(
                                        alignment: Alignment.center,
                                        transform: Matrix4.skewX(-0.35),
                                        child: Container(
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              colors: [
                                                Colors.transparent,
                                                Colors.white.withValues(alpha: 0.75),
                                                Colors.transparent,
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 22),

                    // Tagline: "THE FUTURE OF ENTERTAINMENT"
                    AnimatedBuilder(
                      animation: _taglineOpacity,
                      builder: (context, child) {
                        return Opacity(
                          opacity: _taglineOpacity.value.clamp(0.0, 1.0),
                          child: child,
                        );
                      },
                      child: const Text(
                        'THE FUTURE OF ENTERTAINMENT',
                        style: TextStyle(
                          color: Color(0xFFFDBA74),
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 4.5,
                        ),
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Time-of-day Greeting
                    AnimatedBuilder(
                      animation: _greetingOpacity,
                      builder: (context, child) {
                        return Opacity(
                          opacity: _greetingOpacity.value.clamp(0.0, 1.0),
                          child: child,
                        );
                      },
                      child: ShaderMask(
                        shaderCallback: (bounds) => const LinearGradient(
                          colors: [
                            Color(0xFFFED7AA),
                            Colors.white,
                            Color(0xFFFED7AA),
                          ],
                        ).createShader(bounds),
                        child: Text(
                          greeting,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                            shadows: [
                              Shadow(
                                color: Color(0x60F97316),
                                blurRadius: 14,
                                offset: Offset(0, 2),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PeacockFeatherPainter extends CustomPainter {
  final double animationProgress;
  final bool isDark;

  PeacockFeatherPainter({required this.animationProgress, required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height * 0.44;

    // 1. Ambient Iridescent Radiance
    final glowPaint = Paint()
      ..shader = RadialGradient(
        center: const Alignment(0.0, -0.12),
        radius: 0.85,
        colors: isDark
            ? [
                const Color(0xFF0D9488).withValues(alpha: 0.18 + 0.08 * math.sin(animationProgress * math.pi)),
                const Color(0xFF1E3A8A).withValues(alpha: 0.14),
                const Color(0xFF042F2E).withValues(alpha: 0.08),
                Colors.transparent,
              ]
            : [
                const Color(0xFF0D9488).withValues(alpha: 0.08),
                const Color(0xFFFDE68A).withValues(alpha: 0.06),
                Colors.transparent,
              ],
        stops: const [0.0, 0.40, 0.70, 1.0],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), glowPaint);

    // 2. Peacock Feather Stem (Rachis)
    final stemPath = Path();
    stemPath.moveTo(cx, size.height * 0.85);
    stemPath.quadraticBezierTo(cx - 15, size.height * 0.60, cx, cy);

    final stemPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..shader = LinearGradient(
        begin: Alignment.bottomCenter,
        end: Alignment.topCenter,
        colors: [
          const Color(0xFF047857).withValues(alpha: 0.0),
          const Color(0xFF10B981).withValues(alpha: 0.35),
          const Color(0xFFF59E0B).withValues(alpha: 0.45),
        ],
      ).createShader(Rect.fromLTWH(cx - 30, cy, 60, size.height * 0.85 - cy));
    canvas.drawPath(stemPath, stemPaint);

    // 3. Peacock Feather Barbs (Plumules) radiating outwards
    final barbPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const barbCount = 28;
    for (int i = 0; i < barbCount; i++) {
      final t = i / barbCount;
      final yStem = cy + (size.height * 0.82 - cy) * (t * 0.85 + 0.15);
      final spread = math.sin(t * math.pi) * (size.width * 0.42);
      final curveFactor = (1.0 - t) * 35;
      final alpha = (math.sin(t * math.pi) * 0.22 * (0.6 + 0.4 * math.sin(animationProgress * math.pi + i * 0.2))).clamp(0.04, 0.35);

      // Left Barb
      barbPaint.strokeWidth = 1.0 + (1.0 - t) * 0.8;
      barbPaint.color = Color.lerp(
        const Color(0xFF059669),
        const Color(0xFF3B82F6),
        t,
      )!.withValues(alpha: alpha);

      final leftPath = Path();
      leftPath.moveTo(cx - 2, yStem);
      leftPath.quadraticBezierTo(
        cx - spread * 0.55,
        yStem - curveFactor,
        cx - spread,
        yStem - curveFactor * 0.6,
      );
      canvas.drawPath(leftPath, barbPaint);

      // Right Barb
      barbPaint.color = Color.lerp(
        const Color(0xFF10B981),
        const Color(0xFF6366F1),
        t,
      )!.withValues(alpha: alpha);

      final rightPath = Path();
      rightPath.moveTo(cx + 2, yStem);
      rightPath.quadraticBezierTo(
        cx + spread * 0.55,
        yStem - curveFactor,
        cx + spread,
        yStem - curveFactor * 0.6,
      );
      canvas.drawPath(rightPath, barbPaint);
    }

    // 4. Peacock Feather Eye (Ocellus)
    final eyeCenter = Offset(cx, cy);
    final eyeScale = (0.85 + 0.15 * math.sin(animationProgress * math.pi)).clamp(0.8, 1.1);

    // Layer A: Outer Sapphire Halo
    final outerHaloPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFF1E3A8A).withValues(alpha: isDark ? 0.32 : 0.15),
          const Color(0xFF0F172A).withValues(alpha: 0.0),
        ],
      ).createShader(Rect.fromCircle(center: eyeCenter, radius: 100 * eyeScale));
    canvas.drawOval(
      Rect.fromCenter(center: eyeCenter, width: 170 * eyeScale, height: 210 * eyeScale),
      outerHaloPaint,
    );

    // Layer B: Teal & Turquoise Ring
    final tealRingPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14 * eyeScale
      ..shader = SweepGradient(
        center: const Alignment(0, 0),
        colors: [
          const Color(0xFF0D9488).withValues(alpha: 0.30),
          const Color(0xFF06B6D4).withValues(alpha: 0.40),
          const Color(0xFF10B981).withValues(alpha: 0.35),
          const Color(0xFF0D9488).withValues(alpha: 0.30),
        ],
      ).createShader(Rect.fromCircle(center: eyeCenter, radius: 55 * eyeScale));
    canvas.drawOval(
      Rect.fromCenter(center: eyeCenter, width: 110 * eyeScale, height: 135 * eyeScale),
      tealRingPaint,
    );

    // Layer C: Golden Bronze Inner Core
    final goldCorePaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFFF59E0B).withValues(alpha: 0.45),
          const Color(0xFFD97706).withValues(alpha: 0.25),
          Colors.transparent,
        ],
        stops: const [0.0, 0.65, 1.0],
      ).createShader(Rect.fromCircle(center: eyeCenter, radius: 45 * eyeScale));
    canvas.drawOval(
      Rect.fromCenter(center: eyeCenter, width: 75 * eyeScale, height: 95 * eyeScale),
      goldCorePaint,
    );

    // Layer D: Midnight Indigo Heart Pupil
    final pupilPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFF312E81).withValues(alpha: 0.60),
          const Color(0xFF1E1B4B).withValues(alpha: 0.80),
        ],
      ).createShader(Rect.fromCircle(center: eyeCenter, radius: 24 * eyeScale));
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx, cy + 4), width: 42 * eyeScale, height: 50 * eyeScale),
      pupilPaint,
    );

    // Specular glimmer dot
    final sparkPaint = Paint()..color = Colors.white.withValues(alpha: 0.55);
    canvas.drawCircle(Offset(cx - 6 * eyeScale, cy - 4 * eyeScale), 2.5 * eyeScale, sparkPaint);
  }

  @override
  bool shouldRepaint(covariant PeacockFeatherPainter oldDelegate) {
    return oldDelegate.animationProgress != animationProgress || oldDelegate.isDark != isDark;
  }
}
