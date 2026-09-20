import 'dart:ui';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/localization/app_strings.dart';

class AppLanguageItem {
  final String code;
  final String name;
  final String nativeName;
  final Locale locale;

  const AppLanguageItem({
    required this.code,
    required this.name,
    required this.nativeName,
    required this.locale,
  });

  AppStrings get strings => AppStrings.get(code);
}

class AppLanguages {
  static const List<AppLanguageItem> supported = [
    AppLanguageItem(code: 'en', name: 'English', nativeName: 'English', locale: Locale('en')),
    AppLanguageItem(code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', locale: Locale('hi')),
    AppLanguageItem(code: 'bn', name: 'Bengali', nativeName: 'বাংলা', locale: Locale('bn')),
    AppLanguageItem(code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', locale: Locale('ta')),
    AppLanguageItem(code: 'te', name: 'Telugu', nativeName: 'తెలుగు', locale: Locale('te')),
    AppLanguageItem(code: 'mr', name: 'Marathi', nativeName: 'मराठी', locale: Locale('mr')),
    AppLanguageItem(code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', locale: Locale('gu')),
    AppLanguageItem(code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', locale: Locale('kn')),
    AppLanguageItem(code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', locale: Locale('ml')),
    AppLanguageItem(code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', locale: Locale('pa')),
    AppLanguageItem(code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', locale: Locale('or')),
    AppLanguageItem(code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', locale: Locale('as')),
  ];

  static const defaultLanguage = AppLanguageItem(
    code: 'en',
    name: 'English',
    nativeName: 'English',
    locale: Locale('en'),
  );

  static List<Locale> get supportedLocales => supported.map((l) => l.locale).toList();

  static AppLanguageItem find(String? code) {
    if (code == null) return defaultLanguage;
    final normalized = code.toLowerCase().split('_')[0].split('-')[0];
    return supported.firstWhere(
      (l) => l.code == normalized,
      orElse: () => defaultLanguage,
    );
  }
}

class AppLanguageNotifier extends StateNotifier<AppLanguageItem> {
  static const _storageKey = 'inplayer_app_language';

  AppLanguageNotifier() : super(AppLanguages.defaultLanguage) {
    _loadLanguage();
  }

  Future<void> _loadLanguage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedCode = prefs.getString(_storageKey);
      if (savedCode != null && savedCode.isNotEmpty) {
        state = AppLanguages.find(savedCode);
        return;
      }

      // Check device locale
      final deviceLocale = PlatformDispatcher.instance.locale;
      state = AppLanguages.find(deviceLocale.languageCode);
    } catch (_) {
      state = AppLanguages.defaultLanguage;
    }
  }

  Future<void> setLanguage(String code) async {
    final language = AppLanguages.find(code);
    state = language;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, language.code);
    } catch (_) {
      // Safe fallback
    }
  }
}

final appLanguageProvider = StateNotifierProvider<AppLanguageNotifier, AppLanguageItem>((ref) {
  return AppLanguageNotifier();
});

/// Convenience provider for current strings
final appStringsProvider = Provider<AppStrings>((ref) {
  return ref.watch(appLanguageProvider).strings;
});
