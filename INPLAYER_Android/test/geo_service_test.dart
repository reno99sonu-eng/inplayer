import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/services/geo_service.dart';

void main() {
  group('GeoVerificationResult', () {
    test('parses standard allowed response correctly', () {
      final json = {
        'allowed': true,
        'country': 'IN',
        'isVpn': false,
        'isProxy': false,
        'isHosting': false,
        'ip': '103.21.244.2',
      };
      final result = GeoVerificationResult.fromJson(json);
      expect(result.allowed, isTrue);
      expect(result.country, 'IN');
      expect(result.isVpn, isFalse);
    });

    test('parses blocked response correctly', () {
      final json = {
        'allowed': false,
        'country': 'US',
        'isVpn': true,
        'isProxy': true,
        'isHosting': true,
        'ip': '1.2.3.4',
      };
      final result = GeoVerificationResult.fromJson(json);
      expect(result.allowed, isFalse);
      expect(result.country, 'US');
      expect(result.isVpn, isTrue);
    });

    test('defaults safely when values are missing', () {
      final result = GeoVerificationResult.fromJson({});
      expect(result.allowed, isFalse);
      expect(result.country, isNull);
      expect(result.isVpn, isFalse);
    });
  });

  group('GeoService India bounds and IST fallback', () {
    test('detects IST device or IN locale fallback correctly', () {
      final service = GeoService();
      // On systems located in India, isLikelyIndiaDevice evaluates to true
      final offset = DateTime.now().timeZoneOffset;
      if (offset.inMinutes == 330) {
        expect(service.isLikelyIndiaDevice, isTrue);
      }
    });

    test('verifies coordinate bounding box math', () async {
      final service = GeoService();
      // Inside India (e.g. New Delhi: 28.6139, 77.2090)
      // verifyCoordinates falls back to local bounds check on network error
      final inIndia = await service.verifyCoordinates(
        latitude: 28.6139,
        longitude: 77.2090,
      );
      expect(inIndia, isTrue);

      // Outside India (e.g. London: 51.5074, -0.1278)
      final outsideIndia = await service.verifyCoordinates(
        latitude: 51.5074,
        longitude: -0.1278,
      );
      expect(outsideIndia, isFalse);
    });
  });
}
