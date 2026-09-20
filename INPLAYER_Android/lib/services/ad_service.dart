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

  /// Fetches the mid-roll advertising configuration and creatives from the backend.
  /// Returns null or disabled config if midrolls are turned off in platform settings.
  Future<MidrollConfig?> getMidrollConfig() async {
    try {
      final response = await _dio.get(ApiConstants.midrollAds);
      if (response.statusCode == 200 && response.data is Map) {
        return MidrollConfig.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
    } catch (e) {
      _logger.e('Error fetching midroll config: $e');
    }
    return null;
  }

  /// Tracks a mid-roll ad event ('click' or 'skip') to the backend.
  Future<void> trackMidrollEvent(String adId, {required String kind}) async {
    try {
      await _dio.post(ApiConstants.midrollAds, data: {'adId': adId, 'kind': kind});
    } catch (e) {
      _logger.e('Error tracking midroll $kind for $adId: $e');
    }
  }
}

class MidrollAd {
  final String adId;
  final String imageUrl;
  final String linkUrl;
  final String title;

  MidrollAd({
    required this.adId,
    required this.imageUrl,
    required this.linkUrl,
    required this.title,
  });

  factory MidrollAd.fromJson(Map<String, dynamic> json) {
    return MidrollAd(
      adId: json['adId']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString() ?? '',
      linkUrl: json['linkUrl']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
    );
  }
}

class MidrollConfig {
  final bool enabled;
  final int intervalSeconds;
  final List<int> skipTiersSeconds;
  final MidrollAd? ad;
  final List<MidrollAd> ads;

  MidrollConfig({
    required this.enabled,
    this.intervalSeconds = 120,
    this.skipTiersSeconds = const [5, 10, 15],
    this.ad,
    this.ads = const [],
  });

  factory MidrollConfig.fromJson(Map<String, dynamic> json) {
    final enabled = json['enabled'] == true;
    if (!enabled) {
      return MidrollConfig(enabled: false);
    }
    final adsList = <MidrollAd>[];
    if (json['ads'] is List) {
      for (final a in (json['ads'] as List)) {
        if (a is Map) {
          adsList.add(MidrollAd.fromJson(Map<String, dynamic>.from(a)));
        }
      }
    }
    MidrollAd? singleAd;
    if (json['ad'] is Map) {
      singleAd = MidrollAd.fromJson(Map<String, dynamic>.from(json['ad']));
    } else if (adsList.isNotEmpty) {
      singleAd = adsList.first;
    }

    final skipTiers = <int>[];
    if (json['skipTiersSeconds'] is List) {
      for (final item in (json['skipTiersSeconds'] as List)) {
        if (item is num) skipTiers.add(item.toInt());
      }
    }

    return MidrollConfig(
      enabled: true,
      intervalSeconds: (json['intervalSeconds'] as num?)?.toInt() ?? 120,
      skipTiersSeconds: skipTiers.isNotEmpty ? skipTiers : const [5, 10, 15],
      ad: singleAd,
      ads: adsList,
    );
  }
}

