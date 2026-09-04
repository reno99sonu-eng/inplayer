import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Persisted equalizer state: whether it is switched on, and the gain in
/// decibels for each band.
///
/// Gains are stored positionally rather than by frequency because the band
/// layout comes from Android itself and differs between devices — five
/// bands is typical but it is whatever the platform equalizer reports. A
/// list saved on one phone is therefore applied only as far as it lines up
/// with the bands the current phone actually has, and any surplus entries
/// are ignored instead of throwing.
class EqualizerSettings {
  final bool enabled;
  final List<double> gains;

  const EqualizerSettings({this.enabled = false, this.gains = const []});

  EqualizerSettings copyWith({bool? enabled, List<double>? gains}) {
    return EqualizerSettings(
      enabled: enabled ?? this.enabled,
      gains: gains ?? this.gains,
    );
  }

  Map<String, dynamic> toJson() => {'enabled': enabled, 'gains': gains};

  factory EqualizerSettings.fromJson(Map<String, dynamic> json) {
    final rawGains = json['gains'];
    return EqualizerSettings(
      enabled: json['enabled'] as bool? ?? false,
      gains: rawGains is List
          ? rawGains
                .map((g) => g is num ? g.toDouble() : 0.0)
                .toList(growable: false)
          : const [],
    );
  }
}

class EqualizerStore {
  EqualizerStore._();

  static const _key = 'inplayer:music-equalizer';

  static Future<EqualizerSettings> get() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null) return const EqualizerSettings();
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return EqualizerSettings.fromJson(decoded);
      }
    } catch (_) {
      // A corrupt blob falls back to "off", which is the same as never
      // having touched the equalizer — never worth failing playback over.
    }
    return const EqualizerSettings();
  }

  static Future<void> save(EqualizerSettings settings) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, jsonEncode(settings.toJson()));
    } catch (_) {
      // Losing a preference is not worth surfacing an error for.
    }
  }
}
