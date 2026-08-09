import 'package:flutter/material.dart';

import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,

      brightness: Brightness.dark,

      // fontFamily: 'PlusJakartaSans', // Uncomment when fonts are added

      scaffoldBackgroundColor: AppColors.backgroundDark,

      colorScheme: const ColorScheme.dark(
        primary: AppColors.brandOrange,
        secondary: AppColors.brandGold,
        surface: AppColors.surfaceDark,
      ),

      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.backgroundDark,
        foregroundColor: AppColors.textPrimaryDark,
        centerTitle: false,
        elevation: 0,
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
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    );
  }
}