import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'equalizer_presets.dart';

/// Persisted equalizer state: whether it is switched on, which named preset
/// is selected, and the gain in decibels for each band.
///
/// Both the preset id and the resolved gains are stored, and that is
/// deliberate. The gains are what actually gets pushed to the platform at
/// startup, so restoring does not have to wait on band frequencies being
/// readable; the preset id is what the picker highlights, and what lets the
/// app re-derive the curve correctly if the person moves to a phone with a
/// different band layout.
///
/// Gains are stored positionally rather than by frequency because the band
/// layout comes from Android itself and differs between devices — five
/// bands is typical but it is whatever the platform equalizer reports. A
/// list saved on one phone is therefore applied only as far as it lines up
/// with the bands the current phone actually has, and any surplus entries
/// are ignored instead of throwing.
class EqualizerSettings {
  final bool enabled;

  /// A value from [EqualizerPreset.all], or [EqualizerPreset.customId] once
  /// the sliders have been moved by hand.
  final String preset;

  final List<double> gains;

  const EqualizerSettings({
    this.enabled = false,
    this.preset = 'flat',
    this.gains = const [],
  });

  EqualizerSettings copyWith({
    bool? enabled,
    String? preset,
    List<double>? gains,
  }) {
    return EqualizerSettings(
      enabled: enabled ?? this.enabled,
      preset: preset ?? this.preset,
      gains: gains ?? this.gains,
    );
  }

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'preset': preset,
        'gains': gains,
      };

  factory EqualizerSettings.fromJson(Map<String, dynamic> json) {
    final rawGains = json['gains'];
    final gains = rawGains is List
        ? rawGains
            .map((g) => g is num ? g.toDouble() : 0.0)
            .toList(growable: false)
        : const <double>[];

    // Blobs written before presets existed have no 'preset' key. Anything
    // with a non-zero gain in it was hand-tuned by definition, so it is
    // Custom; anything else is indistinguishable from Flat.
    final storedPreset = json['preset'];
    final preset = storedPreset is String && storedPreset.isNotEmpty
        ? storedPreset
        : (gains.any((g) => g.abs() > 0.01)
            ? EqualizerPreset.customId
            : 'flat');

    return EqualizerSettings(
      enabled: json['enabled'] as bool? ?? false,
      preset: preset,
      gains: gains,
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
