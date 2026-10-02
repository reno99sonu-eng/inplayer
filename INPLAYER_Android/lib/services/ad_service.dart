import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import 'platform_settings_service.dart';

/// One house ad creative, as returned by GET /api/ads (app/api/ads/route.ts).
/// Only the "house" source (a real admin-uploaded image + link) is built
/// here — Google-served AdMob banners are rendered by the native home-feed
/// placement, which reads its Android settings from platform settings.
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

/// Google AdMob configuration synchronized real-time from InPlayer Admin Panel.
class AdMobConfig {
  final bool enabled;
  final String appId;
  final String bannerUnitId;
  final String interstitialUnitId;
  final String rewardedUnitId;
  final String nativeUnitId;
  final String openAppUnitId;

  const AdMobConfig({
    this.enabled = false,
    this.appId = '',
    this.bannerUnitId = '',
    this.interstitialUnitId = '',
    this.rewardedUnitId = '',
    this.nativeUnitId = '',
    this.openAppUnitId = '',
  });

  factory AdMobConfig.fromSettings(PublicPlatformSettings settings) {
    return AdMobConfig(
      enabled: settings.admobEnabled,
      appId: settings.admobAppId,
      bannerUnitId: settings.admobBannerUnitId,
      interstitialUnitId: settings.admobInterstitialUnitId,
      rewardedUnitId: settings.admobRewardedUnitId,
      nativeUnitId: settings.admobNativeUnitId,
      openAppUnitId: settings.admobOpenAppUnitId,
    );
  }
}

final admobConfigProvider = Provider<AdMobConfig>((ref) {
  final settings = ref.watch(publicPlatformSettingsProvider).value ?? PublicPlatformSettings.normal;
  return AdMobConfig.fromSettings(settings);
});

final adServiceProvider = Provider<AdService>((ref) {
  return AdService();
});

class AdService {
  final _dio = DioClient().dio;
  final _logger = Logger();
  static const _midrollCacheTtl = Duration(seconds: 30);
  MidrollConfig? _cachedMidrollConfig;
  DateTime? _midrollConfigCachedAt;
  Future<MidrollConfig?>? _midrollConfigRequest;

  /// Returns the first real house creative for a placement, or null when
  /// the slot is off or has nothing active right now.
  Future<AdCreative?> getAd(String placement) async {
    try {
      final response = await _dio.get(ApiConstants.ads, queryParameters: {'placement': placement});
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        if (data['source'] == 'house' && data['creative'] is Map) {
          final creative = AdCreative.fromJson(Map<String, dynamic>.from(data['creative']));
          if (creative.adId.isNotEmpty && creative.imageUrl.isNotEmpty) {
            return creative;
          }
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
  Future<MidrollConfig?> getMidrollConfig({bool forceRefresh = false}) {
    final cachedAt = _midrollConfigCachedAt;
    if (!forceRefresh &&
        cachedAt != null &&
        DateTime.now().difference(cachedAt) < _midrollCacheTtl) {
      return Future.value(_cachedMidrollConfig);
    }
    final inFlight = _midrollConfigRequest;
    if (!forceRefresh && inFlight != null) return inFlight;

    final request = _fetchMidrollConfig();
    _midrollConfigRequest = request;
    return request.whenComplete(() {
      if (identical(_midrollConfigRequest, request)) {
        _midrollConfigRequest = null;
      }
    });
  }

  Future<MidrollConfig?> _fetchMidrollConfig() async {
    try {
      // The Android app serves only creatives created in Admin > Advertising.
      // Paid sponsorship creatives share the backend table, so the source
      // selector must be explicit and confirmed by the API response.
      final response = await _dio.get(
        ApiConstants.midrollAds,
        queryParameters: {'source': 'house'},
      );
      if (response.statusCode == 200 && response.data is Map) {
        final config = MidrollConfig.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
        _cachedMidrollConfig = config;
        _midrollConfigCachedAt = DateTime.now();
        return config;
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
  final bool houseOnly;
  final int intervalSeconds;
  final List<int> skipTiersSeconds;
  final MidrollAd? ad;
  final List<MidrollAd> ads;

  MidrollConfig({
    required this.enabled,
    this.houseOnly = false,
    this.intervalSeconds = 120,
    this.skipTiersSeconds = const [5, 10, 15],
    this.ad,
    this.ads = const [],
  });

  factory MidrollConfig.fromJson(Map<String, dynamic> json) {
    final enabled = json['enabled'] == true;
    final houseOnly = json['source'] == 'house';
    if (!enabled || !houseOnly) {
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
      houseOnly: true,
      intervalSeconds: (json['intervalSeconds'] as num?)?.toInt() ?? 120,
      skipTiersSeconds: skipTiers.isNotEmpty ? skipTiers : const [5, 10, 15],
      ad: singleAd,
      ads: adsList,
    );
  }
}

