import 'dart:ui';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/network/dio_client.dart';

final geoServiceProvider = Provider<GeoService>((ref) {
  return GeoService();
});

class GeoVerificationResult {
  final bool allowed;
  final String? country;
  final bool isVpn;
  final bool isProxy;
  final bool isHosting;
  final String? ip;

  const GeoVerificationResult({
    required this.allowed,
    this.country,
    this.isVpn = false,
    this.isProxy = false,
    this.isHosting = false,
    this.ip,
  });

  factory GeoVerificationResult.fromJson(Map<String, dynamic> json) {
    return GeoVerificationResult(
      // A malformed or incomplete response must never grant access.
      allowed: json['allowed'] as bool? ?? false,
      country: json['country'] as String?,
      isVpn: json['isVpn'] as bool? ?? false,
      isProxy: json['isProxy'] as bool? ?? false,
      isHosting: json['isHosting'] as bool? ?? false,
      ip: json['ip'] as String?,
    );
  }
}

/// Service that verifies geo-location restrictions matching the website
/// (/api/geo/verify).
class GeoService {
  final _logger = Logger();
  final Dio _dio = DioClient().dio;

  bool get isLikelyIndiaDevice {
    final offset = DateTime.now().timeZoneOffset;
    // IST is UTC+5:30 (330 minutes)
    if (offset.inMinutes == 330) return true;
    final countryCode =
        PlatformDispatcher.instance.locale.countryCode?.toUpperCase();
    if (countryCode == 'IN') return true;
    return false;
  }

  /// Verifies current client IP against geo boundaries and VPN/proxy detection.
  Future<GeoVerificationResult> verifyGeo() async {
    try {
      final response = await _dio.get(
        '/api/geo/verify',
        options: Options(
          receiveTimeout: const Duration(seconds: 4),
          sendTimeout: const Duration(seconds: 4),
        ),
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data is Map<String, dynamic>
            ? response.data as Map<String, dynamic>
            : <String, dynamic>{};
        return GeoVerificationResult.fromJson(data);
      }
    } catch (e) {
      _logger.w('Geo verification check failed; falling back to device signals: $e');
    }

    // Fallback: If network check failed or server returned non-200, but device
    // is in Indian Standard Time (UTC+5:30) or has IN locale, allow access.
    if (isLikelyIndiaDevice) {
      _logger.i('Network geo check unavailable; device is in IST/India, allowing access.');
      return const GeoVerificationResult(allowed: true, country: 'IN');
    }

    return const GeoVerificationResult(allowed: false);
  }

  /// Verifies GPS latitude and longitude against India's geographic bounding box.
  Future<bool> verifyCoordinates({
    required double latitude,
    required double longitude,
  }) async {
    // Physical bounding box of India:
    // Latitude: 6.0 to 37.5
    // Longitude: 68.0 to 97.5
    final isWithinIndiaBounds =
        (latitude >= 6.0 && latitude <= 37.5) &&
        (longitude >= 68.0 && longitude <= 97.5);

    try {
      final response = await _dio.post(
        '/api/geo/verify',
        data: {'latitude': latitude, 'longitude': longitude},
        options: Options(
          receiveTimeout: const Duration(seconds: 4),
          sendTimeout: const Duration(seconds: 4),
        ),
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data is Map<String, dynamic> ? response.data : {};
        return data['allowed'] as bool? ?? isWithinIndiaBounds;
      }
    } catch (e) {
      _logger.w('Coordinate verification network call failed; using local bounds: $e');
    }
    return isWithinIndiaBounds;
  }
}
