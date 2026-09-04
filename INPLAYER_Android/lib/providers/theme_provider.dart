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
  ThemeNotifier() : super(ThemeChoice.system) {
    _loadSavedTheme();
  }

  // There used to be a Timer.periodic here that ran every minute and did
  // `state = ThemeChoice.system; // trigger notification` whenever the choice
  // was already system. It never notified anything: StateNotifier only tells
  // listeners about a value that actually CHANGED, and that assigns the same
  // enum back. So themeModeProvider never recomputed and "Auto (Day/Night)"
  // simply never flipped at 06:00 or 18:00 — you got whichever mode was
  // current when the app launched, until you restarted it.
  //
  // The recomputation now lives in themeModeProvider below, which schedules
  // itself for the next boundary rather than waking up sixty times an hour to
  // do nothing.

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
      final now = DateTime.now();

      // One timer, aimed at the exact next boundary, which then invalidates
      // this provider so it recomputes. Polling every minute would do the
      // same job 1,439 times a day for nothing; this fires twice.
      final timer = Timer(_untilNextDayNightBoundary(now), ref.invalidateSelf);
      ref.onDispose(timer.cancel);

      final isDay = now.hour >= _dayStartHour && now.hour < _dayEndHour;
      return isDay ? ThemeMode.light : ThemeMode.dark;
  }
});

/// Time from [now] until the next 06:00 or 18:00, whichever comes first.
Duration _untilNextDayNightBoundary(DateTime now) {
  final dayStart = DateTime(now.year, now.month, now.day, _dayStartHour);
  final dayEnd = DateTime(now.year, now.month, now.day, _dayEndHour);
  final nextDayStart = dayStart.add(const Duration(days: 1));

  final DateTime next;
  if (now.isBefore(dayStart)) {
    next = dayStart;
  } else if (now.isBefore(dayEnd)) {
    next = dayEnd;
  } else {
    next = nextDayStart;
  }

  // A second of slack. A timer that fires a hair early would land back inside
  // the window it just left, recompute the same answer, and reschedule almost
  // immediately — a tight loop rather than a theme change.
  return next.difference(now) + const Duration(seconds: 1);
}
