import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get darkTheme {
    // The website's whole visual identity runs on Plus Jakarta Sans (see
    // app/layout.tsx's next/font/google import) — the app was previously
    // rendering everything in Android's default system font (Roboto),
    // which is a big part of why it read as generic/unbranded rather than
    // a real InPlayer surface. google_fonts fetches and caches the exact
    // same family at runtime.
    final base = ThemeData(brightness: Brightness.dark, useMaterial3: true);
    final textTheme = GoogleFonts.plusJakartaSansTextTheme(base.textTheme)
        .apply(
          bodyColor: AppColors.textPrimaryDark,
          displayColor: AppColors.textPrimaryDark,
        );

    return ThemeData(
      useMaterial3: true,

      brightness: Brightness.dark,

      textTheme: textTheme,
      fontFamily: GoogleFonts.plusJakartaSans().fontFamily,

      scaffoldBackgroundColor: AppColors.backgroundDark,

      colorScheme: const ColorScheme.dark(
        primary: AppColors.brandOrange,
        secondary: AppColors.brandGold,
        surface: AppColors.surfaceDark,
      ),

      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.backgroundDark,
        foregroundColor: AppColors.textPrimaryDark,
        centerTitle: false,
        elevation: 0,
        titleTextStyle: GoogleFonts.plusJakartaSans(
          color: AppColors.textPrimaryDark,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
      ),

      cardColor: AppColors.cardDark,

      dividerColor: Colors.white12,

      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.brandOrange,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 52),
          textStyle: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w700,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    );
  }
}