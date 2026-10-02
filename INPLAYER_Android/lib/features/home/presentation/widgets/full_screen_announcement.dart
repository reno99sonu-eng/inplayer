import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_colors.dart';

/// A home-only, full-screen glass announcement from platform settings.
/// The restrained perspective motion stops when the device requests reduced
/// motion, and the underlying page remains visible through the blurred scrim.
class FullScreenAnnouncement extends StatefulWidget {
  final String message;
  final String linkUrl;
  final VoidCallback onClose;

  const FullScreenAnnouncement({
    super.key,
    required this.message,
    required this.linkUrl,
    required this.onClose,
  });

  @override
  State<FullScreenAnnouncement> createState() => _FullScreenAnnouncementState();
}

class _FullScreenAnnouncementState extends State<FullScreenAnnouncement>
    with SingleTickerProviderStateMixin {
  late final AnimationController _motion;
  bool? _reduceMotion;

  @override
  void initState() {
    super.initState();
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 6),
      value: 0.5,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    if (_reduceMotion == reduceMotion) return;

    _reduceMotion = reduceMotion;
    if (reduceMotion) {
      _motion.stop();
      _motion.value = 0.5;
    } else {
      _motion.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  Uri _visitTarget() {
    final candidate = Uri.tryParse(widget.linkUrl.trim());
    if (candidate != null &&
        candidate.hasAuthority &&
        (candidate.scheme == 'https' || candidate.scheme == 'http')) {
      return candidate;
    }
    return Uri.parse('https://inplayer.in');
  }

  Future<void> _visit() async {
    try {
      final opened = await launchUrl(
        _visitTarget(),
        mode: LaunchMode.externalApplication,
      );
      if (opened && mounted) widget.onClose();
    } catch (error) {
      debugPrint('Could not open the announcement link: $error');
    }
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = _reduceMotion ?? false;

    return Positioned.fill(
      child: Material(
        color: Colors.transparent,
        child: Stack(
          fit: StackFit.expand,
          children: [
            BackdropFilter(
              filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
              child: ColoredBox(color: Colors.black.withValues(alpha: 0.43)),
            ),
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 460),
                    child: AnimatedBuilder(
                      animation: _motion,
                      builder: (context, child) {
                        final tilt = reduceMotion
                            ? 0.0
                            : math.sin(_motion.value * math.pi * 2);
                        final lift = reduceMotion
                            ? 0.0
                            : math.cos(_motion.value * math.pi * 2);
                        final transform = Matrix4.identity()
                          ..setEntry(3, 2, 0.0014)
                          ..rotateX(tilt * 0.018)
                          ..rotateY(lift * 0.022)
                          ..scale(1 + lift.abs() * 0.004);

                        return Transform(
                          alignment: Alignment.center,
                          transform: transform,
                          child: child,
                        );
                      },
                      child: _buildCard(context),
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

  Widget _buildCard(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.fromLTRB(22, 22, 22, 20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xC71B1B26), Color(0xB8172432), Color(0xC0201725)],
        ),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
        boxShadow: [
          BoxShadow(
            color: AppColors.brandOrange.withValues(alpha: 0.18),
            blurRadius: 38,
            spreadRadius: 2,
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 46,
            offset: const Offset(0, 22),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            top: -53,
            right: -37,
            child: IgnorePointer(
              child: Container(
                width: 132,
                height: 132,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.brandOrange.withValues(alpha: 0.34),
                      const Color(0xFF8B5CF6).withValues(alpha: 0.17),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFFFFB340), Color(0xFFFF6A1A)],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.brandOrange.withValues(alpha: 0.3),
                          blurRadius: 20,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.campaign_rounded,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'ANNOUNCEMENT',
                      style: textTheme.labelLarge?.copyWith(
                        color: const Color(0xFFFFB340),
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close announcement',
                    onPressed: widget.onClose,
                    icon: const Icon(Icons.close_rounded),
                    color: Colors.white70,
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.09),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 25),
              Text(
                widget.message,
                style: textTheme.headlineSmall?.copyWith(
                  color: Colors.white,
                  height: 1.25,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.45,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Stay up to date with what’s happening on InPlayer.',
                style: textTheme.bodyMedium?.copyWith(
                  color: Colors.white.withValues(alpha: 0.72),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 28),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: widget.onClose,
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: const Text('Close'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(52),
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.28),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(17),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      onPressed: _visit,
                      icon: const Icon(Icons.open_in_new_rounded, size: 18),
                      label: const Text('Visit'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.brandOrange,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(52),
                        elevation: 8,
                        shadowColor: AppColors.brandOrange.withValues(
                          alpha: 0.38,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(17),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
