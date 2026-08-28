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
      duration: const Duration(milliseconds: 3400),
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
    _logoTilt = Tween<double>(begin: .075, end: 0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0, .38, curve: Curves.easeOutCubic),
      ),
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
    }, fireImmediately: true);
    unawaited(_loadCachedName());
    _startAnimation();
    _triggerGeoCheck();
  }

  void _startAnimation() {
    // This only safeguards an interrupted animation; normal completion wins.
    _fallbackTimer = Timer(const Duration(milliseconds: 4300), _dismissSplash);

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
                RepaintBoundary(
                  child: AnimatedBuilder(
                    animation: _controller,
                    builder: (context, _) => CustomPaint(
                      painter: PeacockFeatherPainter(
                        animationProgress: _controller.value,
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
                          builder: (context, child) => Transform.scale(
                            scale: _logoScale.value,
                            child: Transform(
                              alignment: Alignment.center,
                              transform: Matrix4.identity()
                                ..setEntry(3, 2, .001)
                                ..rotateX(_logoTilt.value),
                              child: Opacity(
                                opacity: _logoOpacity.value
                                    .clamp(0, 1)
                                    .toDouble(),
                                child: child,
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

/// Low-contrast feather silhouettes, deliberately offset away from the
/// wordmark. This is ornamental background texture, not a second logo.
class PeacockFeatherPainter extends CustomPainter {
  final double animationProgress;

  const PeacockFeatherPainter({required this.animationProgress});

  @override
  void paint(Canvas canvas, Size size) {
    final shimmer = .75 + (.25 * math.sin(animationProgress * math.pi));
    final ambient = Paint()
      ..shader = RadialGradient(
        center: const Alignment(.72, -.52),
        radius: 1.05,
        colors: [
          const Color(0xFF0F766E).withValues(alpha: .12 * shimmer),
          const Color(0xFF172554).withValues(alpha: .10 * shimmer),
          Colors.transparent,
        ],
        stops: const [0, .48, 1],
      ).createShader(Offset.zero & size);
    canvas.drawRect(Offset.zero & size, ambient);

    final unit = math.min(size.width / 430, size.height / 820);
    final scale = unit.clamp(.68, 1.18).toDouble();
    _drawFeather(
      canvas,
      eye: Offset(size.width * .83, size.height * .26),
      scale: scale,
      opacity: .46 * shimmer,
      mirrored: false,
    );
    _drawFeather(
      canvas,
      eye: Offset(size.width * .15, size.height * .79),
      scale: scale * .82,
      opacity: .24 * shimmer,
      mirrored: true,
    );
  }

  void _drawFeather(
    Canvas canvas, {
    required Offset eye,
    required double scale,
    required double opacity,
    required bool mirrored,
  }) {
    canvas.save();
    canvas.translate(eye.dx, eye.dy);
    canvas.scale(mirrored ? -scale : scale, scale);

    final stem = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFFEAB308), Color(0xFF14B8A6), Color(0xFF0F172A)],
      ).createShader(const Rect.fromLTWH(-8, 0, 18, 220));
    canvas.drawPath(
      Path()
        ..moveTo(0, 18)
        ..quadraticBezierTo(-8, 92, 10, 220),
      stem..color = stem.color.withValues(alpha: opacity),
    );

    final barb = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    for (var index = 0; index < 18; index++) {
      final t = index / 17;
      final y = 28 + (t * 162);
      final length = 22 + (math.sin(t * math.pi) * 96);
      final curve = 12 + (1 - t) * 24;
      barb
        ..strokeWidth = 0.7 + ((1 - t) * .6)
        ..color = Color.lerp(
          const Color(0xFF22C55E),
          const Color(0xFF38BDF8),
          t,
        )!.withValues(alpha: opacity * (.17 + (math.sin(t * math.pi) * .20)));
      canvas.drawPath(
        Path()
          ..moveTo(-2 + (t * 4), y)
          ..quadraticBezierTo(
            -length * .52,
            y - curve,
            -length,
            y - curve * .42,
          ),
        barb,
      );
      canvas.drawPath(
        Path()
          ..moveTo(2 + (t * 4), y)
          ..quadraticBezierTo(length * .52, y - curve, length, y - curve * .42),
        barb,
      );
    }

    final halo = Paint()
      ..shader =
          RadialGradient(
            colors: [
              const Color(0xFF1D4ED8).withValues(alpha: opacity * .28),
              Colors.transparent,
            ],
          ).createShader(
            Rect.fromCenter(center: Offset.zero, width: 116, height: 138),
          );
    canvas.drawOval(
      Rect.fromCenter(center: Offset.zero, width: 116, height: 138),
      halo,
    );

    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7
      ..shader =
          SweepGradient(
            colors: [
              const Color(0xFF0D9488).withValues(alpha: opacity * .48),
              const Color(0xFF06B6D4).withValues(alpha: opacity * .52),
              const Color(0xFFF59E0B).withValues(alpha: opacity * .36),
              const Color(0xFF0D9488).withValues(alpha: opacity * .48),
            ],
          ).createShader(
            Rect.fromCenter(center: Offset.zero, width: 58, height: 76),
          );
    canvas.drawOval(
      Rect.fromCenter(center: Offset.zero, width: 58, height: 76),
      ring,
    );
    final pupil = Paint()
      ..color = const Color(0xFF312E81).withValues(alpha: opacity * .48);
    canvas.drawOval(
      Rect.fromCenter(center: Offset.zero, width: 23, height: 34),
      pupil,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant PeacockFeatherPainter oldDelegate) {
    return oldDelegate.animationProgress != animationProgress;
  }
}
