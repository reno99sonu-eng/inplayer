import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';

final premiumServiceProvider = Provider<PremiumService>((ref) {
  return PremiumService();
});

/// `GET /api/premium/me`'s full response — whether the viewer is Premium,
/// and the server-decided ceiling for their tier alone (before any Settings
/// > Playback quality preference is applied — see [effectiveMaxResolution]
/// below for that combination, mirroring app/lib/premium.ts exactly).
class PremiumStatus {
  final bool premium;
  final String maxResolution;
  /// ISO date string the current Premium term runs until, if any — shown on
  /// the Plans & Purchases page (real status, even though the app links out
  /// to the website for the actual Razorpay purchase/renewal itself).
  final String? premiumUntil;
  const PremiumStatus({required this.premium, required this.maxResolution, this.premiumUntil});
}

class PremiumService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<PremiumStatus> getStatus() async {
    try {
      final response = await _dio.get('/api/premium/me');
      if (response.statusCode == 200 && response.data != null) {
        return PremiumStatus(
          premium: response.data['premium'] == true,
          maxResolution: response.data['maxResolution'] as String? ?? '1080p',
          premiumUntil: response.data['premiumUntil'] as String?,
        );
      }
    } catch (e) {
      _logger.e('Error fetching premium status: $e');
    }
    return const PremiumStatus(premium: false, maxResolution: '1080p'); // Fail closed to the free ceiling.
  }

  /// Kept for callers that only need the tier ceiling, not the full status.
  Future<String> getMaxResolution() async => (await getStatus()).maxResolution;
}

// The values a Settings quality select can be set to — matches
// QUALITY_OPTIONS' `value`s in app/lib/premium.ts (no 480p/360p: those are
// valid Mux MIN renditions but not valid MAX/ceiling ones).
const Map<String, int> _knownResolutionHeights = {
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '2160p': 2160,
};

/// The single place that combines a viewer's real tier ceiling with
/// whatever they picked in Settings > Playback — the direct Dart
/// equivalent of `effectiveMaxResolution()` in app/lib/premium.ts. Always
/// the LOWER of the two, so a free viewer who somehow has "2160p" saved
/// locally still gets capped server-tier-side, and "auto" (or anything
/// unrecognized, e.g. a stale value) simply defers entirely to the tier.
/// Returns a Mux `max_resolution` query value ("1080p", "720p", ...).
String effectiveMaxResolution(String tierMaxResolution, String preferredQuality) {
  final tierHeight = int.tryParse(tierMaxResolution.replaceAll(RegExp(r'[^0-9]'), '')) ?? 1080;
  final preferredHeight = _knownResolutionHeights[preferredQuality];
  if (preferredHeight == null || preferredHeight >= tierHeight) {
    return '${tierHeight}p';
  }
  return '${preferredHeight}p';
}
