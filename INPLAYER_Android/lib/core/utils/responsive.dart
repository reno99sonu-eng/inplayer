import 'package:flutter/material.dart';

/// Standard Material responsive breakpoints:
/// - Phone: width < 600dp
/// - Tablet portrait: 600dp <= width < 840dp
/// - Large / Tablet landscape: width >= 840dp
class Breakpoints {
  Breakpoints._();

  static const double phoneMax = 600.0;
  static const double tabletMax = 840.0;
  static const double desktopMax = 1100.0;

  static const double maxContentWidth = 1200.0;
  static const double maxFormWidth = 720.0;
  static const double maxDialogWidth = 560.0;
  static const double maxHeroHeight = 440.0;
}

extension ResponsiveContext on BuildContext {
  double get screenWidth => MediaQuery.of(this).size.width;
  double get screenHeight => MediaQuery.of(this).size.height;
  Orientation get screenOrientation => MediaQuery.of(this).orientation;

  bool get isPhone => screenWidth < Breakpoints.phoneMax;
  bool get isTablet => screenWidth >= Breakpoints.phoneMax && screenWidth < Breakpoints.tabletMax;
  bool get isTabletPortrait => isTablet && screenOrientation == Orientation.portrait;
  bool get isLargeScreen => screenWidth >= Breakpoints.tabletMax;
  bool get isTabletOrLarger => screenWidth >= Breakpoints.phoneMax;
  bool get isWideLandscape => screenWidth >= Breakpoints.tabletMax && screenOrientation == Orientation.landscape;

  /// Calculates responsive column counts for video feeds and grids:
  /// - Phone (< 600): 1 column
  /// - Tablet portrait (600 - 839): 2 columns
  /// - Tablet landscape (840 - 1099): 3 columns
  /// - Large screen / Desktop (>= 1100): 4 columns
  int get responsiveVideoColumns {
    if (screenWidth >= Breakpoints.desktopMax) return 4;
    if (screenWidth >= Breakpoints.tabletMax) return 3;
    if (screenWidth >= Breakpoints.phoneMax) return 2;
    return 1;
  }
}

/// A lightweight wrapper that horizontally centers content and constrains its
/// maximum width on large displays, leaving phone displays full-width.
class ResponsiveContent extends StatelessWidget {
  final Widget child;
  final double maxWidth;
  final EdgeInsetsGeometry padding;

  const ResponsiveContent({
    super.key,
    required this.child,
    this.maxWidth = Breakpoints.maxFormWidth,
    this.padding = EdgeInsets.zero,
  });

  @override
  Widget build(BuildContext context) {
    if (context.screenWidth <= maxWidth) {
      return Padding(padding: padding, child: child);
    }
    return Padding(
      padding: padding,
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: child,
        ),
      ),
    );
  }
}
