import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:audioplayers/audioplayers.dart';
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

  @override
  void initState() {
    super.initState();

    // Single unified master controller for rock-solid 60/120fps sync.
    // All the Interval() curves below are expressed as fractions of this
    // total, so they rescale automatically with it — changing this one
    // duration re-times the entire choreography (logo zoom, flash, shine
    // sweep, tagline/greeting fade, exit curtain) proportionally without
    // touching any of the Interval() calls below. Set to 3000ms (3s) per
    // explicit request — was 1150ms.
    _masterController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    );

    // 1. Logo Zoom & Tilt (0% -> 40%)
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
    // Non-blocking geo-verification matching the website's fail-open strategy
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
    // Safety net only — normally _masterController's forward().then()
    // below fires _dismissSplash() right as the animation completes.
    // This just guarantees the splash can't get stuck forever if that
    // somehow doesn't happen, so it's set a comfortable margin (800ms)
    // beyond the animation's own 3000ms duration rather than racing it.
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

  @override
  void dispose() {
    _fallbackTimer?.cancel();
    _masterController.dispose();
    _audioPlayer?.dispose();
    super.dispose();
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    return 'Evening';
  }

  @override
  Widget build(BuildContext context) {
    if (!_isVisible) return const SizedBox.shrink();

    final isDark = context.isDark;
    final authState = ref.watch(authStateProvider);
    final user = authState is AuthStateAuthenticated ? authState.user : null;
    final greeting = 'Good ${_getGreeting()}${user != null && user.name.isNotEmpty ? ', ${user.name}' : ''}';

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
        color: isDark ? const Color(0xFF020203) : const Color(0xFFF4ECDA),
        child: Stack(
          alignment: Alignment.center,
          children: [
            // 1. Flash Burst Wash
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

            // 2. Centered Logo & Content
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
