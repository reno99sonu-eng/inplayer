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

  factory GeoVerificationResult.allowedDefault() {
    return const GeoVerificationResult(allowed: true);
  }

  factory GeoVerificationResult.fromJson(Map<String, dynamic> json) {
    return GeoVerificationResult(
      allowed: json['allowed'] as bool? ?? true,
      country: json['country'] as String?,
      isVpn: json['isVpn'] as bool? ?? false,
      isProxy: json['isProxy'] as bool? ?? false,
      isHosting: json['isHosting'] as bool? ?? false,
      ip: json['ip'] as String?,
    );
  }
}

/// Service that verifies geo-location restrictions matching the website
/// (/api/geo/verify) with a resilient fail-open policy for legitimate viewers.
class GeoService {
  final _logger = Logger();
  final Dio _dio = DioClient().dio;

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
      _logger.w('Geo verification check failed, failing open: ');
    }

    // Fail open fallback matching website behavior: do not lock out real users
    return GeoVerificationResult.allowedDefault();
  }

  /// Verifies GPS latitude and longitude against India's geographic bounding box.
  Future<bool> verifyCoordinates({required double latitude, required double longitude}) async {
    try {
      final response = await _dio.post(
        '/api/geo/verify',
        data: {
          'latitude': latitude,
          'longitude': longitude,
        },
        options: Options(
          receiveTimeout: const Duration(seconds: 4),
          sendTimeout: const Duration(seconds: 4),
        ),
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data is Map<String, dynamic> ? response.data : {};
        return data['allowed'] as bool? ?? true;
      }
    } catch (e) {
      _logger.w('Coordinate verification failed, failing open: ');
    }
    return true; // Fail open
  }
}
