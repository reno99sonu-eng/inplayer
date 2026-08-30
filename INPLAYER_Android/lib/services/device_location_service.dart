import 'package:geolocator/geolocator.dart';

import 'geo_service.dart';

/// Requests the Android location permission and verifies coordinates against
/// the same backend geo gate used by the website. The IP check always runs
/// first so a VPN cannot bypass the server's proxy/hosting detection by
/// reporting an in-country GPS coordinate.
Future<GeoVerificationResult> requestDeviceLocation(GeoService service) async {
  final ipResult = await service.verifyGeo();
  if (!ipResult.allowed) return ipResult;

  try {
    if (!await Geolocator.isLocationServiceEnabled()) return ipResult;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return ipResult;
    }
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.low,
        timeLimit: Duration(seconds: 4),
      ),
    );
    final allowed = await service.verifyCoordinates(
      latitude: position.latitude,
      longitude: position.longitude,
    );
    return GeoVerificationResult(
      allowed: ipResult.allowed && allowed,
      country: ipResult.country,
      isVpn: ipResult.isVpn,
      isProxy: ipResult.isProxy,
      isHosting: ipResult.isHosting,
      ip: ipResult.ip,
    );
  } catch (_) {
    // Keep the verified IP result if GPS is unavailable or denied.
    return ipResult;
  }
}
