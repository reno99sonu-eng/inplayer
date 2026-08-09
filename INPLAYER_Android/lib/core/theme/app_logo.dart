import 'package:flutter/material.dart';

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
    return Image.asset(
      'assets/images/logo_triangle.png',
      height: height ?? 40,
      width: width,
      fit: BoxFit.contain,
    );
  }
}