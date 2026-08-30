import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Direct native equivalent of the website's `PlaybackSettings` (see
/// app/components/settings/SettingsProvider.tsx) — same field names and
/// same defaults, so a setting means the same thing on both platforms even
/// though the two stores (localStorage vs. shared_preferences) are never
/// actually shared. `mobileQuality`/`wifiQuality` use the same value union
/// as the website's `QualityChoice` type (app/lib/premium.ts): 'auto',
/// '720p', '1080p', '1440p', or '2160p' — anything else (including legacy
/// display strings like the website's own old "Ultra HD (4K)" default) is
/// treated as 'auto' wherever it's read, never crashes.
class PlaybackSettings {
  final String mobileQuality;
  final String wifiQuality;
  final String audioQuality;
  final bool autoplay;
  final bool pip;
  final bool captions;
  final bool dataSaver;
  final bool rememberPosition;
  final bool skipIntro;
  final bool backgroundPlayback;

  const PlaybackSettings({
    this.mobileQuality = 'auto',
    this.wifiQuality = 'auto',
    this.audioQuality = 'High',
    this.autoplay = true,
    this.pip = true,
    this.captions = false,
    this.dataSaver = false,
    this.rememberPosition = true,
    this.skipIntro = false,
    this.backgroundPlayback = true,
  });

  PlaybackSettings copyWith({
    String? mobileQuality,
    String? wifiQuality,
    String? audioQuality,
    bool? autoplay,
    bool? pip,
    bool? captions,
    bool? dataSaver,
    bool? rememberPosition,
    bool? skipIntro,
    bool? backgroundPlayback,
  }) {
    return PlaybackSettings(
      mobileQuality: mobileQuality ?? this.mobileQuality,
      wifiQuality: wifiQuality ?? this.wifiQuality,
      audioQuality: audioQuality ?? this.audioQuality,
      autoplay: autoplay ?? this.autoplay,
      pip: pip ?? this.pip,
      captions: captions ?? this.captions,
      dataSaver: dataSaver ?? this.dataSaver,
      rememberPosition: rememberPosition ?? this.rememberPosition,
      skipIntro: skipIntro ?? this.skipIntro,
      backgroundPlayback: backgroundPlayback ?? this.backgroundPlayback,
    );
  }

  Map<String, dynamic> toJson() => {
        'mobileQuality': mobileQuality,
        'wifiQuality': wifiQuality,
        'audioQuality': audioQuality,
        'autoplay': autoplay,
        'pip': pip,
        'captions': captions,
        'dataSaver': dataSaver,
        'rememberPosition': rememberPosition,
        'skipIntro': skipIntro,
        'backgroundPlayback': backgroundPlayback,
      };

  factory PlaybackSettings.fromJson(Map<String, dynamic> json) {
    const fallback = PlaybackSettings();
    return PlaybackSettings(
      mobileQuality: json['mobileQuality'] as String? ?? fallback.mobileQuality,
      wifiQuality: json['wifiQuality'] as String? ?? fallback.wifiQuality,
      audioQuality: json['audioQuality'] as String? ?? fallback.audioQuality,
      autoplay: json['autoplay'] as bool? ?? fallback.autoplay,
      pip: json['pip'] as bool? ?? fallback.pip,
      captions: json['captions'] as bool? ?? fallback.captions,
      dataSaver: json['dataSaver'] as bool? ?? fallback.dataSaver,
      rememberPosition: json['rememberPosition'] as bool? ?? fallback.rememberPosition,
      skipIntro: json['skipIntro'] as bool? ?? fallback.skipIntro,
      backgroundPlayback: json['backgroundPlayback'] as bool? ?? fallback.backgroundPlayback,
    );
  }
}

/// Persisted the same "one JSON blob, hydrated on read" way the website's
/// SettingsProvider persists to localStorage under 'inplayer-settings',
/// just via shared_preferences. Read by the watch page (captions default,
/// quality preference) and the Shorts player (mobile quality preference),
/// written by PlaybackSettingsPage.
class PlaybackSettingsStore {
  PlaybackSettingsStore._();
  static const _key = 'inplayer:playback-settings';

  static String _normalizeQualityChoice(String? value) {
    final raw = (value ?? 'auto').trim().toLowerCase();
    switch (raw) {
      case '720p':
      case '1080p':
      case '1440p':
      case '2160p':
        return raw;
      case 'auto':
      default:
        return 'auto';
    }
  }

  static String _normalizeAudioChoice(String? value) {
    final raw = (value ?? 'High').trim().toLowerCase();
    return raw == 'low' ? 'Low' : 'High';
  }

  static PlaybackSettings sanitize(PlaybackSettings settings) {
    return settings.copyWith(
      mobileQuality: _normalizeQualityChoice(settings.mobileQuality),
      wifiQuality: _normalizeQualityChoice(settings.wifiQuality),
      audioQuality: _normalizeAudioChoice(settings.audioQuality),
    );
  }

  static Future<PlaybackSettings> get() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return const PlaybackSettings();
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return sanitize(PlaybackSettings.fromJson(decoded));
      }
    } catch (_) {
      // Corrupt/unparseable blob — fall through to defaults rather than
      // crash the watch page over a bad settings write.
    }
    return sanitize(const PlaybackSettings());
  }

  static Future<void> update(PlaybackSettings settings) async {
    final sanitized = sanitize(settings);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(sanitized.toJson()));
  }
}
