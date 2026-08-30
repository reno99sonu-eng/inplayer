import 'dart:async';
import 'dart:math' as math;

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../models/user.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/geo_service.dart';

/// The short branded overlay shown above the router on each cold start.
///
/// The display name comes from a local cache immediately, then is refreshed by
/// the auth provider while the animation is still on screen. That keeps the
/// greeting dependable without delaying the first frame for Cognito/network
/// work.
class SplashScreenOverlay extends ConsumerStatefulWidget {
  final VoidCallback? onDismiss;

  const SplashScreenOverlay({super.key, this.onDismiss});

  @override
  ConsumerState<SplashScreenOverlay> createState() =>
      _SplashScreenOverlayState();
}

class _SplashScreenOverlayState extends ConsumerState<SplashScreenOverlay>
    with SingleTickerProviderStateMixin {
  static const _cachedNameKey = 'inplayer:cached_user_name';

  late final AnimationController _controller;
  late final Animation<double> _logoScale;
  late final Animation<double> _logoOpacity;
  late final Animation<double> _logoTilt;
  late final Animation<double> _logoFloat;
  late final Animation<double> _logoGlow;
  late final Animation<double> _flashOpacity;
  late final Animation<double> _shinePosition;
  late final Animation<double> _taglineOpacity;
  late final Animation<double> _greetingOpacity;
  late final Animation<double> _curtainOpacity;
  late final ProviderSubscription<AuthState> _authSubscription;

  AudioPlayer? _audioPlayer;
  Timer? _fallbackTimer;
  bool _isVisible = true;
  String _displayName = '';

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4200),
    );

    _logoScale =
        TweenSequence<double>([
          TweenSequenceItem(
            tween: Tween<double>(
              begin: .78,
              end: 1.04,
            ).chain(CurveTween(curve: Curves.easeOutCubic)),
            weight: 76,
          ),
          TweenSequenceItem(
            tween: Tween<double>(
              begin: 1.04,
              end: 1,
            ).chain(CurveTween(curve: Curves.easeInOut)),
            weight: 24,
          ),
        ]).animate(
          CurvedAnimation(parent: _controller, curve: const Interval(0, .44)),
        );
    _logoOpacity = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0, .22, curve: Curves.easeIn),
    );
    _logoTilt = Tween<double>(begin: .08, end: 0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0, .42, curve: Curves.easeOutCubic),
      ),
    );
    _logoFloat =
        TweenSequence<double>([
          TweenSequenceItem(
            tween: Tween<double>(
              begin: 26,
              end: -18,
            ).chain(CurveTween(curve: Curves.easeOutBack)),
            weight: 50,
          ),
          TweenSequenceItem(
            tween: Tween<double>(
              begin: -18,
              end: 8,
            ).chain(CurveTween(curve: Curves.easeInOutCubic)),
            weight: 50,
          ),
        ]).animate(
          CurvedAnimation(
            parent: _controller,
            curve: const Interval(.08, .92, curve: Curves.easeInOutCubic),
          ),
        );
    _logoGlow =
        TweenSequence<double>([
          TweenSequenceItem(
            tween: Tween<double>(
              begin: .18,
              end: 1.0,
            ).chain(CurveTween(curve: Curves.easeOutQuart)),
            weight: 42,
          ),
          TweenSequenceItem(
            tween: Tween<double>(
              begin: 1.0,
              end: .62,
            ).chain(CurveTween(curve: Curves.easeInOutCubic)),
            weight: 58,
          ),
        ]).animate(
          CurvedAnimation(parent: _controller, curve: const Interval(.10, .82)),
        );
    _flashOpacity =
        TweenSequence<double>([
          TweenSequenceItem(
            tween: Tween<double>(
              begin: 0,
              end: .42,
            ).chain(CurveTween(curve: Curves.easeInQuad)),
            weight: 35,
          ),
          TweenSequenceItem(
            tween: Tween<double>(
              begin: .42,
              end: 0,
            ).chain(CurveTween(curve: Curves.easeOutQuad)),
            weight: 65,
          ),
        ]).animate(
          CurvedAnimation(parent: _controller, curve: const Interval(.10, .35)),
        );
    _shinePosition = Tween<double>(begin: -1.15, end: 1.4).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(.28, .62, curve: Curves.easeInOutCubic),
      ),
    );
    _taglineOpacity = CurvedAnimation(
      parent: _controller,
      curve: const Interval(.43, .65, curve: Curves.easeOut),
    );
    _greetingOpacity = CurvedAnimation(
      parent: _controller,
      curve: const Interval(.54, .78, curve: Curves.easeOut),
    );
    _curtainOpacity = Tween<double>(begin: 1, end: 0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(.88, 1, curve: Curves.easeInOutCubic),
      ),
    );

    _authSubscription = ref.listenManual<AuthState>(authStateProvider, (
      _,
      next,
    ) {
      if (next is AuthStateAuthenticated) {
        _setDisplayName(_preferredName(next.user), persist: true);
      }
    });
    unawaited(_loadCachedName());
    _startAnimation();
    _triggerGeoCheck();
  }

  void _startAnimation() {
    // This only safeguards an interrupted animation; normal completion wins.
    _fallbackTimer = Timer(const Duration(milliseconds: 5000), _dismissSplash);

    try {
      _audioPlayer = AudioPlayer()..setVolume(1);
      unawaited(
        _audioPlayer!
            .play(AssetSource('sounds/splash-logo-sting.mp3'))
            .catchError((_) {}),
      );
    } catch (_) {
      // The branding animation remains usable if audio hardware is occupied.
    }

    _controller.forward().whenComplete(_dismissSplash);
  }

  void _triggerGeoCheck() {
    unawaited(
      ref
          .read(geoServiceProvider)
          .verifyGeo()
          .then((result) {
            if (!result.allowed) {
              debugPrint(
                '[InPlayer] Geo verification restriction flagged: ${result.country}',
              );
            }
          })
          .catchError((_) {}),
    );
  }

  static String _preferredName(User user) {
    final name = user.name.toString().trim();
    if (name.isNotEmpty) return name;
    return user.username.toString().trim();
  }

  Future<void> _loadCachedName() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final name =
          [
            prefs.getString(_cachedNameKey),
            prefs.getString('inplayer:user_name'),
            prefs.getString('user_name'),
            prefs.getString('username'),
          ].firstWhere(
            (candidate) => candidate != null && candidate.trim().isNotEmpty,
            orElse: () => null,
          );
      if (name != null) _setDisplayName(name);
    } catch (_) {
      // No cache is fine for a first-time/signed-out launch.
    }
  }

  void _setDisplayName(String rawName, {bool persist = false}) {
    final name = rawName.trim();
    if (name.isEmpty || name == _displayName) return;

    if (mounted) {
      setState(() => _displayName = name);
    } else {
      _displayName = name;
    }

    if (persist) {
      unawaited(
        SharedPreferences.getInstance().then(
          (prefs) => prefs.setString(_cachedNameKey, name),
        ),
      );
    }
  }

  void _dismissSplash() {
    if (!_isVisible || !mounted) return;
    _fallbackTimer?.cancel();
    setState(() => _isVisible = false);
    widget.onDismiss?.call();
  }

  String _greetingForCurrentTime() {
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  void dispose() {
    _fallbackTimer?.cancel();
    _authSubscription.close();
    _controller.dispose();
    unawaited(_audioPlayer?.dispose() ?? Future<void>.value());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isVisible) {
      return const IgnorePointer(ignoring: true, child: SizedBox.expand());
    }

    final authState = ref.watch(authStateProvider);
    final signedInName = authState is AuthStateAuthenticated
        ? _preferredName(authState.user)
        : '';
    final name = signedInName.isNotEmpty ? signedInName : _displayName;
    final greeting = name.isEmpty
        ? _greetingForCurrentTime()
        : '${_greetingForCurrentTime()}, $name';

    return SizedBox.expand(
      child: IgnorePointer(
        ignoring: !_isVisible,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return Opacity(
              opacity: _curtainOpacity.value.clamp(0, 1).toDouble(),
              child: child,
            );
          },
          child: Material(
            // The splash is intentionally black in both app themes. It keeps
            // the light wordmark and the peacock accents coherent on startup.
            color: const Color(0xFF02050A),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Positioned.fill(
                  child: AnimatedBuilder(
                    animation: _controller,
                    builder: (context, child) => Transform.scale(
                      // A restrained, continuous push-in across the same
                      // timeline as the existing logo and sound sting.
                      scale: 1.0 + (_controller.value * 0.10),
                      alignment: Alignment.center,
                      child: child,
                    ),
                    child: Opacity(
                      opacity: 0.28,
                      child: Image.asset(
                        'assets/images/my_peacock_feather.png',
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
                AnimatedBuilder(
                  animation: _flashOpacity,
                  builder: (context, _) => IgnorePointer(
                    child: Opacity(
                      opacity: _flashOpacity.value.clamp(0, 1).toDouble(),
                      child: const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: RadialGradient(
                            center: Alignment(0, -.08),
                            radius: .68,
                            colors: [
                              Color(0x1AFFFFFF),
                              Color(0x1490D7FF),
                              Colors.transparent,
                            ],
                            stops: [0, .45, 1],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedBuilder(
                          animation: _controller,
                          builder: (context, child) => Transform.translate(
                            offset: Offset(0, _logoFloat.value),
                            child: Transform.scale(
                              scale: _logoScale.value,
                              child: Transform(
                                alignment: Alignment.center,
                                transform: Matrix4.identity()
                                  ..setEntry(3, 2, .001)
                                  ..rotateX(_logoTilt.value)
                                  ..rotateZ(-_logoTilt.value * .24),
                                child: Opacity(
                                  opacity: _logoOpacity.value
                                      .clamp(0, 1)
                                      .toDouble(),
                                  child: AnimatedBuilder(
                                    animation: _logoGlow,
                                    builder: (context, _) => DecoratedBox(
                                      decoration: BoxDecoration(
                                        boxShadow: [
                                          BoxShadow(
                                            color: AppColors.brandOrange
                                                .withValues(
                                                  alpha: _logoGlow.value * .35,
                                                ),
                                            blurRadius:
                                                22 + _logoGlow.value * 26,
                                            spreadRadius:
                                                2 + _logoGlow.value * 6,
                                          ),
                                          BoxShadow(
                                            color: const Color(0xFF4DD0E1)
                                                .withValues(
                                                  alpha: _logoGlow.value * .18,
                                                ),
                                            blurRadius:
                                                30 + _logoGlow.value * 30,
                                          ),
                                        ],
                                      ),
                                      child: child,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          child: _AnimatedWordmark(
                            shinePosition: _shinePosition,
                          ),
                        ),
                        const SizedBox(height: 22),
                        FadeTransition(
                          opacity: _taglineOpacity,
                          child: const Text(
                            'THE FUTURE OF ENTERTAINMENT',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFFFDBA74),
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 3.2,
                            ),
                          ),
                        ),
                        const SizedBox(height: 13),
                        FadeTransition(
                          opacity: _greetingOpacity,
                          child: SizedBox(
                            width: 300,
                            child: AnimatedSwitcher(
                              duration: const Duration(milliseconds: 180),
                              switchInCurve: Curves.easeOut,
                              switchOutCurve: Curves.easeIn,
                              child: FittedBox(
                                key: ValueKey(greeting),
                                fit: BoxFit.scaleDown,
                                child: ShaderMask(
                                  shaderCallback: (bounds) =>
                                      const LinearGradient(
                                        colors: [
                                          Color(0xFFFED7AA),
                                          Colors.white,
                                          Color(0xFFBCEFFF),
                                        ],
                                      ).createShader(bounds),
                                  child: Text(
                                    greeting,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: .35,
                                      shadows: [
                                        Shadow(
                                          color: Color(0x4D4CD7D0),
                                          blurRadius: 14,
                                          offset: Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 18,
                  child: FadeTransition(
                    opacity: _taglineOpacity,
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Made in India',
                          style: TextStyle(
                            color: Color(0xC9FDE68A),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.1,
                          ),
                        ),
                        SizedBox(width: 7),
                        Text('🇮🇳', style: TextStyle(fontSize: 15, height: 1)),
                      ],
                    ),
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

class _AnimatedWordmark extends StatelessWidget {
  final Animation<double> shinePosition;

  const _AnimatedWordmark({required this.shinePosition});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.brandOrange.withValues(alpha: .28),
            blurRadius: 34,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: const Color(0xFF22D3EE).withValues(alpha: .12),
            blurRadius: 50,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Image.asset(
              'assets/images/inplayer-mark-dark.png',
              height: 76,
              fit: BoxFit.contain,
            ),
            Positioned.fill(
              child: AnimatedBuilder(
                animation: shinePosition,
                builder: (context, _) => FractionallySizedBox(
                  alignment: Alignment(shinePosition.value, 0),
                  widthFactor: .45,
                  child: Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.skewX(-.35),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.transparent,
                            Colors.white.withValues(alpha: .54),
                            Colors.transparent,
                          ],
                        ),
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
  }
}

/// A full-bleed peacock train backdrop: one faded circular plume of elongated
/// upper-tail coverts behind the InPlayer wordmark, with a saturated jewel tone
/// palette that feels luminous against the deep charcoal background.
class PeacockFeatherPainter extends CustomPainter {
  final double animationProgress;

  const PeacockFeatherPainter({required this.animationProgress});

  static const List<Color> _featherPalette = [
    Color(0xFF22C55E),
    Color(0xFF14B8A6),
    Color(0xFF3B82F6),
    Color(0xFF8B5CF6),
    Color(0xFFF59E0B),
    Color(0xFFE879F9),
    Color(0xFFE11D48),
    Color(0xFF38BDF8),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final reveal = animationProgress.clamp(0.0, 1.0);
    final center = Offset(size.width * 0.5, size.height * 0.44);
    final orbitRadius =
        math.min(size.width, size.height) * (0.26 + reveal * 0.28);

    final ambient = Paint()
      ..shader = RadialGradient(
        center: const Alignment(0.52, 0.42),
        radius: 1.15,
        colors: [
          const Color(0xFF1B2A55).withValues(alpha: 0.48),
          const Color(0xFF0A0F1A).withValues(alpha: 0.82),
          const Color(0xFF02050A),
        ],
        stops: const [0.0, 0.55, 1.0],
      ).createShader(Offset.zero & size);
    canvas.drawRect(Offset.zero & size, ambient);

    final halo = Paint()
      ..shader =
          RadialGradient(
            center: Alignment.center,
            radius: 0.9,
            colors: [
              const Color(0xFF22D3EE).withValues(alpha: 0.18 + reveal * 0.18),
              const Color(0xFF1D4ED8).withValues(alpha: 0.08 + reveal * 0.08),
              Colors.transparent,
            ],
          ).createShader(
            Rect.fromCenter(
              center: center,
              width: size.width * 0.96,
              height: size.height * 0.92,
            ),
          );
    canvas.drawCircle(center, orbitRadius * 1.28, halo);

    for (var i = 0; i < 18; i++) {
      final angle = (i / 18) * (math.pi * 2) - math.pi / 2;
      final featherRadius = orbitRadius * (0.58 + (i % 3) * 0.08);
      final featherLength = size.height * (0.16 + (i % 5) * 0.04);
      final drawProgress = ((reveal * 1.15) - (i / 18.0) * 0.18).clamp(
        0.0,
        1.0,
      );
      if (drawProgress <= 0.02) continue;

      final featherCenter = Offset(
        center.dx + math.cos(angle) * featherRadius,
        center.dy + math.sin(angle) * featherRadius,
      );

      canvas.save();
      canvas.translate(featherCenter.dx, featherCenter.dy);
      canvas.rotate(angle + math.pi / 2);

      final baseColor = _featherPalette[i % _featherPalette.length];
      final featherAlpha = (0.18 + reveal * 0.62) * drawProgress;
      final featherPaint = Paint()
        ..style = PaintingStyle.fill
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            baseColor.withValues(alpha: featherAlpha * 0.95),
            baseColor.withValues(alpha: featherAlpha * 0.60),
            const Color(0xFF0F172A).withValues(alpha: featherAlpha * 0.30),
          ],
          stops: const [0.0, 0.52, 1.0],
        ).createShader(Rect.fromLTWH(-16, -featherLength, 32, featherLength));

      final featherPath = Path()
        ..moveTo(0, 0)
        ..quadraticBezierTo(18, -featherLength * 0.14, 10, -featherLength)
        ..lineTo(0, -(featherLength * 0.92))
        ..quadraticBezierTo(-10, -featherLength * 0.14, 0, 0);

      canvas.drawPath(featherPath, featherPaint);

      final stemPaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = Colors.white.withValues(alpha: featherAlpha * 0.32);
      canvas.drawLine(
        Offset(0, 0),
        Offset(0, -featherLength * 0.94),
        stemPaint,
      );

      final accent = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..color = const Color(
          0xFFF8FAFC,
        ).withValues(alpha: featherAlpha * 0.22);
      canvas.drawArc(
        Rect.fromCenter(
          center: Offset(0, -featherLength * 0.5),
          width: 24,
          height: 58,
        ),
        -math.pi / 2.2,
        math.pi / 1.6,
        false,
        accent,
      );

      canvas.restore();
    }

    final coreGlow = Paint()
      ..shader =
          RadialGradient(
            center: Alignment.center,
            radius: 1,
            colors: [
              const Color(0xFFFEF3C7).withValues(alpha: 0.34 + reveal * 0.22),
              const Color(0xFF60A5FA).withValues(alpha: 0.12 + reveal * 0.18),
              Colors.transparent,
            ],
          ).createShader(
            Rect.fromCenter(
              center: center,
              width: size.width * 0.32,
              height: size.height * 0.28,
            ),
          );
    canvas.drawCircle(center, orbitRadius * 0.42, coreGlow);

    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..color = const Color(0xFFF8FAFC).withValues(alpha: 0.22 + reveal * 0.28);
    canvas.drawCircle(center, orbitRadius * 0.58, ring);
  }

  @override
  bool shouldRepaint(covariant PeacockFeatherPainter oldDelegate) {
    return oldDelegate.animationProgress != animationProgress;
  }
}
