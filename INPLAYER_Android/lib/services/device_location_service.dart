import 'package:geolocator/geolocator.dart';
import 'package:logger/logger.dart';

import 'geo_service.dart';

final _logger = Logger();

/// Requests device location and verifies access.
///
/// Uses a multi-tiered check:
/// 1. Server IP check (/api/geo/verify)
/// 2. Device hardware GPS coordinates (if permission is granted)
/// 3. Device timezone (IST UTC+5:30) and country locale
///
/// This ensures genuine users in India (on mobile data, Wi-Fi, or during server
/// degradation) are never falsely locked out by geo-blocking.
Future<GeoVerificationResult> requestDeviceLocation(GeoService service) async {
  final ipResult = await service.verifyGeo();

  // Try checking device GPS coordinates to verify physical presence in India
  try {
    if (await Geolocator.isLocationServiceEnabled()) {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.whileInUse ||
          permission == LocationPermission.always) {
        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.low,
            timeLimit: Duration(seconds: 4),
          ),
        );

        final coordsInIndia = await service.verifyCoordinates(
          latitude: position.latitude,
          longitude: position.longitude,
        );

        if (coordsInIndia) {
          // Device is physically inside India!
          return GeoVerificationResult(
            allowed: true,
            country: 'IN',
            isVpn: ipResult.isVpn,
            isProxy: ipResult.isProxy,
            isHosting: ipResult.isHosting,
            ip: ipResult.ip,
          );
        } else {
          _logger.w(
            'GPS coordinates outside India: (${position.latitude}, ${position.longitude})',
          );
          return GeoVerificationResult(
            allowed: false,
            country: ipResult.country,
            isVpn: ipResult.isVpn,
            isProxy: ipResult.isProxy,
            isHosting: ipResult.isHosting,
            ip: ipResult.ip,
          );
        }
      }
    }
  } catch (e) {
    _logger.d('Device GPS check skipped: $e');
  }

  // If IP check allowed access, accept it
  if (ipResult.allowed) {
    return ipResult;
  }

  // If IP check failed (e.g. rate limit, network timeout, carrier CGNAT proxy flag),
  // check if device is in Indian Standard Time (UTC+5:30) or IN locale.
  if (service.isLikelyIndiaDevice) {
    _logger.i('Device is in IST / India locale; granting access.');
    return GeoVerificationResult(
      allowed: true,
      country: 'IN',
      isVpn: ipResult.isVpn,
      isProxy: ipResult.isProxy,
      isHosting: ipResult.isHosting,
      ip: ipResult.ip,
    );
  }

  return ipResult;
}
