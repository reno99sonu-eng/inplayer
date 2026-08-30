import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ==========================
  // DARK THEME (Media / Player screens)
  // ==========================

  static const Color backgroundDark = Color(0xFF05070D);
  static const Color canvasDark = Color(0xFF050816);
  static const Color surfaceDark = Color(0xFF0A0D18);
  static const Color cardDark = Color(0xFF070A12);
  static const Color navbarDark = Color(0xFF06101D);
  static const Color drawerDark = Color(0xFF07101F);
  static const Color modalDark = Color(0xFF07111F);
  static const Color inputDark = Color(0xFF07111F);
  static const Color footerDark = Color(0xFF050816);

  static const Color textPrimaryDark = Color(0xFFF8FAFC);
  static const Color textSecondaryDark = Color(0xFF9CA3AF);
  static const Color textMutedDark = Color(0xFF94A3B8);
  static const Color textDimDark = Color(0xFF64748B);
  static const Color textAccentDark = Color(0xFFFDBA74);

  // ==========================
  // LIGHT THEME (Feed / Channel / Shop screens)
  // ==========================

  static const Color backgroundLight = Color(0xFFF1E7D0);
  static const Color canvasLight = Color(0xFFF4ECDA);
  static const Color surfaceLight = Color(0xFFFBF6EA);
  static const Color cardLight = Color(0xFFFFFFFF);
  static const Color navbarLight = Color(0xFFF5EEDC);
  static const Color drawerLight = Color(0xFFF5EEDC);
  static const Color modalLight = Color(0xFFFBF6EA);
  static const Color inputLight = Color(0xFFFFFFFF);
  static const Color footerLight = Color(0xFFFAF5E9);

  static const Color textPrimaryLight = Color(0xFF2A2015);
  static const Color textSecondaryLight = Color(0xFF5C4A35);
  static const Color textMutedLight = Color(0xFF64748B);
  static const Color textDimLight = Color(0xFF94A3B8);
  static const Color textAccentLight = Color(0xFFEA580C);

  // ==========================
  // BRAND ACCENTS
  // ==========================

  // This is the real InPlayer brand orange used site-wide for every solid
  // CTA, focus ring, and switch (the first stop of the website's own
  // gradient — see flameGradient below). It used to be Tailwind's stock
  // orange-500 (0xFFF97316), which reads as a visibly duller, generic
  // orange next to the real site. brandOrangeDark keeps the same value as
  // an explicit alias so any code that already reads brandOrangeDark for
  // "the site's real orange" keeps working unchanged.
  static const Color brandOrange = Color(0xFFFF7A18);
  static const Color brandOrangeDark = Color(0xFFFF7A18);
  static const Color brandOrangeAccent = Color(0xFFEA580C);
  static const Color brandOrangeLight = Color(0xFFFB923C);
  static const Color brandGold = Color(0xFFFFB454);
  static const Color brandAmber = Color(0xFFFF9A00);
  static const Color brandGoldBright = Color(0xFFFFD54A);
  static const Color amber400 = Color(0xFFFBBF24);
  static const Color amber300 = Color(0xFFFCD34D);

  static const Color indianSaffron = Color(0xFFFF9933);
  static const Color indianGreen = Color(0xFF138808);
  static const Color indianNavy = Color(0xFF000080);

  // ==========================
  // SEMANTIC / STATUS
  // ==========================

  static const Color success = Color(0xFF10B981);
  static const Color successBright = Color(0xFF34D399);
  static const Color error = Color(0xFFEF4444);
  static const Color errorLight = Color(0xFFF87171);
  static const Color info = Color(0xFF3B82F6);
  static const Color warning = Color(0xFFF59E0B);
  static const Color live = Color(0xFFEF4444);
  static const Color music = Color(0xFF8B5CF6);
  static const Color cyan = Color(0xFF06B6D4);
  static const Color kids = Color(0xFF10B981);

  // ==========================
  // GRADIENTS
  // ==========================

  static const LinearGradient flameGradient = LinearGradient(
    colors: [Color(0xFFFF7A18), Color(0xFFFF9A00), Color(0xFFFFD54A)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  static const LinearGradient createGradient = LinearGradient(
    colors: [Color(0xFFF97316), Color(0xFFFBBF24), Color(0xFFFACC15)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  static const LinearGradient adminGradient = LinearGradient(
    colors: [Color(0xFF6366F1), Color(0xFF8B5CF6), Color(0xFFA855F7)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );
}
