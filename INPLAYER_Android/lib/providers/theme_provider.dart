import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _storageKey = 'inplayer-theme';
const _dayStartHour = 6;
const _dayEndHour = 18;

enum ThemeChoice {
  system,
  light,
  dark;

  String get label {
    switch (this) {
      case ThemeChoice.system:
        return 'Auto (Day/Night)';
      case ThemeChoice.light:
        return 'Light Mode';
      case ThemeChoice.dark:
        return 'Dark Mode';
    }
  }

  static ThemeChoice fromString(String? value) {
    switch (value) {
      case 'light':
        return ThemeChoice.light;
      case 'dark':
        return ThemeChoice.dark;
      default:
        return ThemeChoice.system;
    }
  }
}

class ThemeNotifier extends StateNotifier<ThemeChoice> {
  Timer? _autoCheckTimer;

  ThemeNotifier() : super(ThemeChoice.system) {
    _loadSavedTheme();
    // Re-check periodically for daytime boundary flips when in Auto mode
    _autoCheckTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (state == ThemeChoice.system) {
        state = ThemeChoice.system; // trigger notification
      }
    });
  }

  @override
  void dispose() {
    _autoCheckTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadSavedTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_storageKey);
    state = ThemeChoice.fromString(saved);
  }

  Future<void> setTheme(ThemeChoice choice) async {
    state = choice;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, choice.name);
  }
}

final themeChoiceProvider =
    StateNotifierProvider<ThemeNotifier, ThemeChoice>((ref) {
  return ThemeNotifier();
});

final themeModeProvider = Provider<ThemeMode>((ref) {
  final choice = ref.watch(themeChoiceProvider);
  switch (choice) {
    case ThemeChoice.light:
      return ThemeMode.light;
    case ThemeChoice.dark:
      return ThemeMode.dark;
    case ThemeChoice.system:
      final hour = DateTime.now().hour;
      final isDay = hour >= _dayStartHour && hour < _dayEndHour;
      return isDay ? ThemeMode.light : ThemeMode.dark;
  }
});
