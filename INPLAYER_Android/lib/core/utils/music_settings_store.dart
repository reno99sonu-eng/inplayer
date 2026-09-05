import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'playback_settings_store.dart';

/// Music-only preferences.
///
/// Deliberately a separate store from [PlaybackSettings]. That one is a
/// field-for-field mirror of the website's own settings object, read by the
/// watch page and the Raftaar player; bolting audio-only keys onto it would
/// break that correspondence for the sake of saving a file.
///
/// Streaming quality is stored per network because that is the only place
/// the choice has consequences: on Wi-Fi the full stream costs nothing, on
/// mobile data it is the difference between a few MB and a few tens of MB
/// an hour.
class MusicSettings {
  /// Keep playing similar music when the queue runs out.
  final bool autoplay;

  /// Even out the loudness between quiet and loud tracks.
  final bool volumeLevelling;

  /// [qualityHigh] or [qualitySaver].
  final String wifiQuality;
  final String cellularQuality;

  static const String qualityHigh = 'high';
  static const String qualitySaver = 'saver';

  const MusicSettings({
    this.autoplay = true,
    this.volumeLevelling = false,
    this.wifiQuality = qualityHigh,
    this.cellularQuality = qualityHigh,
  });

  MusicSettings copyWith({
    bool? autoplay,
    bool? volumeLevelling,
    String? wifiQuality,
    String? cellularQuality,
  }) {
    return MusicSettings(
      autoplay: autoplay ?? this.autoplay,
      volumeLevelling: volumeLevelling ?? this.volumeLevelling,
      wifiQuality: wifiQuality ?? this.wifiQuality,
      cellularQuality: cellularQuality ?? this.cellularQuality,
    );
  }

  /// True when the audio-only rendition should be used on the network the
  /// phone is currently on.
  bool dataSaverOn({required bool onWifi}) {
    final choice = onWifi ? wifiQuality : cellularQuality;
    return choice == qualitySaver;
  }

  Map<String, dynamic> toJson() => {
        'autoplay': autoplay,
        'volumeLevelling': volumeLevelling,
        'wifiQuality': wifiQuality,
        'cellularQuality': cellularQuality,
      };

  static String _normalizeQuality(Object? value, String fallback) {
    final raw = value?.toString().trim().toLowerCase();
    if (raw == qualityHigh || raw == qualitySaver) return raw!;
    return fallback;
  }

  factory MusicSettings.fromJson(Map<String, dynamic> json) {
    const fallback = MusicSettings();
    return MusicSettings(
      autoplay: json['autoplay'] as bool? ?? fallback.autoplay,
      volumeLevelling:
          json['volumeLevelling'] as bool? ?? fallback.volumeLevelling,
      wifiQuality:
          _normalizeQuality(json['wifiQuality'], fallback.wifiQuality),
      cellularQuality:
          _normalizeQuality(json['cellularQuality'], fallback.cellularQuality),
    );
  }
}

class MusicSettingsStore {
  MusicSettingsStore._();

  static const _key = 'inplayer:music-settings';

  /// Reads the music preferences, seeding them on first run from the single
  /// Data Saver switch this screen used to have.
  ///
  /// Without that seed, anyone who had already turned Data Saver on would
  /// silently be moved back to the full stream by this update — a settings
  /// change they never made, showing up on their mobile data bill.
  static Future<MusicSettings> get() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw != null) {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          return MusicSettings.fromJson(decoded);
        }
      }
      return await _migratedFromPlaybackSettings();
    } catch (_) {
      return const MusicSettings();
    }
  }

  static Future<MusicSettings> _migratedFromPlaybackSettings() async {
    try {
      final legacy = await PlaybackSettingsStore.get();
      if (legacy.audioQuality.toLowerCase() == 'low') {
        return const MusicSettings(
          wifiQuality: MusicSettings.qualitySaver,
          cellularQuality: MusicSettings.qualitySaver,
        );
      }
    } catch (_) {
      // Falling through to defaults is the same as a fresh install.
    }
    return const MusicSettings();
  }

  static Future<void> save(MusicSettings settings) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, jsonEncode(settings.toJson()));
    } catch (_) {
      // Losing a preference is not worth surfacing an error for.
    }
  }
}
