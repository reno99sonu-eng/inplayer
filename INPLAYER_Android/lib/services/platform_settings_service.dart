import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';

/// The safe, public subset of Platform Settings that the admin panel
/// controls — the same payload `toPublicSettings()` returns from
/// GET /api/platform-settings (app/lib/platformSettings.ts).
///
/// Only the fields the app actually acts on are modelled. The endpoint
/// returns a good deal more (AdSense, monetization thresholds, contact
/// addresses); adding a field here is only worth doing when something in
/// the app is going to honour it, otherwise it is a promise the app does
/// not keep.
class PublicPlatformSettings {
  final bool maintenanceMode;
  final String maintenanceMessage;
  final bool announcementEnabled;
  final String announcementText;
  final String announcementLinkUrl;
  final bool signupsEnabled;

  const PublicPlatformSettings({
    this.maintenanceMode = false,
    this.maintenanceMessage = '',
    this.announcementEnabled = false,
    this.announcementText = '',
    this.announcementLinkUrl = '',
    this.signupsEnabled = true,
  });

  /// Everything switched off / allowed. This is what a failed fetch
  /// resolves to, deliberately — see the note in
  /// [PlatformSettingsService.fetch].
  static const PublicPlatformSettings normal = PublicPlatformSettings();

  static bool _bool(dynamic value, {bool fallback = false}) {
    if (value is bool) return value;
    if (value is String) return value.toLowerCase() == 'true';
    return fallback;
  }

  factory PublicPlatformSettings.fromJson(Map<String, dynamic> json) {
    return PublicPlatformSettings(
      maintenanceMode: _bool(json['inplayerMaintenanceMode']),
      maintenanceMessage:
          json['inplayerMaintenanceMessage']?.toString().trim() ?? '',
      announcementEnabled: _bool(json['inplayerAnnouncementEnabled']),
      announcementText:
          json['inplayerAnnouncementText']?.toString().trim() ?? '',
      announcementLinkUrl:
          json['inplayerAnnouncementLinkUrl']?.toString().trim() ?? '',
      // Absent means allowed: never lock people out of signing up because a
      // field was missing from an older settings row.
      signupsEnabled: _bool(json['signupsEnabled'], fallback: true),
    );
  }
}

/// Reads the platform-wide switches the admin panel writes.
///
/// This channel existed on the server and was declared in the app's
/// ApiConstants, but nothing in the app ever called it — so flipping
/// maintenance mode in the admin panel took the website down while the app
/// carried on as if nothing had happened.
class PlatformSettingsService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// Fetches the current settings.
  ///
  /// FAILS OPEN, on purpose. Every failure path returns [normal] rather
  /// than an error, because the only thing this data does is take features
  /// away — a timeout or a 500 must never be able to show a maintenance
  /// screen to someone when the platform is in fact running fine. The cost
  /// of failing the other way is locking every user out of a working app
  /// because one request did not land.
  Future<PublicPlatformSettings> fetch() async {
    try {
      final response = await _dio.get(ApiConstants.platformSettings);
      if (response.statusCode != 200 || response.data is! Map) {
        return PublicPlatformSettings.normal;
      }
      return PublicPlatformSettings.fromJson(
        Map<String, dynamic>.from(response.data as Map),
      );
    } catch (e) {
      _logger.w('Could not read platform settings: $e');
      return PublicPlatformSettings.normal;
    }
  }
}

final platformSettingsServiceProvider = Provider<PlatformSettingsService>(
  (ref) => PlatformSettingsService(),
);

/// Current platform settings, refreshable.
///
/// A FutureProvider rather than a stream: these change rarely, and the app
/// re-reads them on launch and whenever it returns to the foreground (see
/// HomePage), which is soon enough for an admin toggle to take effect
/// without polling the server on a timer.
final publicPlatformSettingsProvider =
    FutureProvider<PublicPlatformSettings>((ref) async {
  return ref.read(platformSettingsServiceProvider).fetch();
});
