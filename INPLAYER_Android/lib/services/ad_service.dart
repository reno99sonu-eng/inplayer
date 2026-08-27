import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';

/// One house ad creative, as returned by GET /api/ads (app/api/ads/route.ts).
/// Only the "house" source (a real admin-uploaded image + link) is built
/// here — the "adsense" source would need a native Google Mobile Ads SDK
/// integration, which isn't something this app can safely add and verify
/// without a compiler in this environment; "off" and "adsense" both just
/// mean no ad card renders.
class AdCreative {
  final String adId;
  final String imageUrl;
  final String linkUrl;
  final String title;

  AdCreative({required this.adId, required this.imageUrl, required this.linkUrl, required this.title});

  factory AdCreative.fromJson(Map<String, dynamic> json) {
    return AdCreative(
      adId: json['adId']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString() ?? '',
      linkUrl: json['linkUrl']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
    );
  }
}

final adServiceProvider = Provider<AdService>((ref) {
  return AdService();
});

class AdService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// Returns the first real house creative for a placement, or null when
  /// the slot is off, AdSense-only, or has nothing active right now.
  Future<AdCreative?> getAd(String placement) async {
    try {
      final response = await _dio.get(ApiConstants.ads, queryParameters: {'placement': placement});
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        if (data['source'] == 'house' && data['creative'] is Map) {
          final creative = AdCreative.fromJson(Map<String, dynamic>.from(data['creative']));
          if (creative.adId.isNotEmpty && creative.imageUrl.isNotEmpty) return creative;
        }
      }
    } catch (e) {
      _logger.e('Error fetching ad for $placement: $e');
    }
    return null;
  }

  Future<void> trackEvent(String adId, {required String event}) async {
    try {
      await _dio.post(ApiConstants.ads, data: {'adId': adId, 'event': event});
    } catch (e) {
      _logger.e('Error tracking ad $event for $adId: $e');
    }
  }
}
