import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'app_theme.dart';

/// The standard InPlayer logo mark.
class AppLogo extends StatelessWidget {
  final double? height;
  final double? width;

  const AppLogo({
    super.key,
    this.height,
    this.width,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    return Image.asset(
      isDark ? 'assets/images/inplayer-mark-dark.png' : 'assets/images/inplayer-mark-light.png',
      height: height ?? 34,
      width: width,
      fit: BoxFit.contain,
    );
  }
}

/// The animated collapsible Top Navbar Logo matching the InPlayer website (`Navbar.tsx`):
/// - Starts expanded in "rolled-out" state (~134px showing full INPLAYER mark).
/// - After 2.5 seconds, smoothly animates / rolls in to "rolled-in" state (~30px showing just the glowing play mark).
/// - Tapping it smoothly toggles or expands it, and navigates home if tapped when open.
class AppNavbarLogo extends StatefulWidget {
  final double height;

  /// Replaces the default "navigate home" tap behaviour.
  ///
  /// This widget has always had its own internal GestureDetector, so any
  /// caller that ALSO wrapped it in one ended up with two tap handlers on
  /// the same pixels. Only the inner one wins the gesture arena, so the
  /// caller's handler silently never ran while this widget's own
  /// context.go('/') did — and firing go('/') while the app is already on
  /// '/' makes go_router tear down and rebuild the entire home shell,
  /// resetting the selected tab and re-fetching the whole feed. Passing the
  /// behaviour in here instead of wrapping the widget keeps there being
  /// exactly one handler, and lets a caller that is already home skip the
  /// navigation entirely.
  final VoidCallback? onTap;

  const AppNavbarLogo({
    super.key,
    this.height = 34,
    this.onTap,
  });

  @override
  State<AppNavbarLogo> createState() => _AppNavbarLogoState();
}

class _AppNavbarLogoState extends State<AppNavbarLogo> {
  bool _isRolledOut = true;
  Timer? _shrinkTimer;

  @override
  void initState() {
    super.initState();
    // Expand on load, then smoothly roll into compact triangle mark after 2.5s
    _shrinkTimer = Timer(const Duration(milliseconds: 2500), () {
      if (mounted) {
        setState(() => _isRolledOut = false);
      }
    });
  }

  @override
  void dispose() {
    _shrinkTimer?.cancel();
    super.dispose();
  }

  void _handleTap() {
    final override = widget.onTap;
    if (override != null) {
      override();
    } else {
      try {
        context.go('/');
      } catch (_) {}
    }
    setState(() => _isRolledOut = true);
    _shrinkTimer?.cancel();
    _shrinkTimer = Timer(const Duration(milliseconds: 3000), () {
      if (mounted) {
        setState(() => _isRolledOut = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    final fullWidth = widget.height * 3.8;
    final compactWidth = widget.height * 0.95;

    return GestureDetector(
      onTap: _handleTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 1600),
        curve: Curves.easeInOutCubicEmphasized,
        width: _isRolledOut ? fullWidth : compactWidth,
        height: widget.height,
        clipBehavior: Clip.hardEdge,
        decoration: const BoxDecoration(),
        child: OverflowBox(
          alignment: Alignment.centerLeft,
          maxWidth: fullWidth,
          minWidth: fullWidth,
          maxHeight: widget.height,
          minHeight: widget.height,
          child: Image.asset(
            isDark ? 'assets/images/inplayer-mark-dark.png' : 'assets/images/inplayer-mark-light.png',
            height: widget.height,
            width: fullWidth,
            fit: BoxFit.contain,
            alignment: Alignment.centerLeft,
          ),
        ),
      ),
    );
  }
}
