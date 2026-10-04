import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ad_service.dart';
import 'admob_consent_service.dart';
import 'premium_service.dart';

final admobInterstitialServiceProvider = Provider<AdMobInterstitialService>((ref) {
  final service = AdMobInterstitialService(ref);
  return service;
});

/// Manages preloading, frequency capping, and presentation of Google AdMob Interstitial Ads.
class AdMobInterstitialService {
  final Ref _ref;

  // Google's official Android Test Interstitial Ad Unit ID for debug/dev mode
  static const String _testInterstitialUnitId = 'ca-app-pub-3940256099942544/1033173712';

  // Minimum interval between full-screen interstitial ads (3 minutes) to comply with AdMob UX policies
  static const Duration _cooldown = Duration(minutes: 3);

  InterstitialAd? _interstitialAd;
  bool _isLoading = false;
  DateTime? _lastShownTime;

  AdMobInterstitialService(this._ref);

  /// Preloads an interstitial ad in the background so it is ready to display instantly.
  Future<void> preloadAd() async {
    if (_isLoading || _interstitialAd != null) return;

    final config = _ref.read(admobConfigProvider);
    if (!config.enabled || config.interstitialUnitId.isEmpty) return;

    // Premium subscribers never see third-party ads
    final isPremium = _ref.read(premiumServiceProvider).isPremium;
    if (isPremium) return;

    _isLoading = true;
    try {
      final canRequest = await _ref.read(admobConsentServiceProvider).initialize();
      if (!canRequest) {
        _isLoading = false;
        return;
      }

      final adUnitId = kReleaseMode ? config.interstitialUnitId : _testInterstitialUnitId;

      await InterstitialAd.load(
        adUnitId: adUnitId,
        request: const AdRequest(),
        adLoadCallback: InterstitialAdLoadCallback(
          onAdLoaded: (ad) {
            _interstitialAd = ad;
            _isLoading = false;
            debugPrint('AdMob Interstitial loaded successfully.');
          },
          onAdFailedToLoad: (error) {
            debugPrint('AdMob Interstitial failed to load: ${error.message} (code ${error.code})');
            _interstitialAd = null;
            _isLoading = false;
          },
        ),
      );
    } catch (e) {
      debugPrint('AdMob Interstitial error during load: $e');
      _isLoading = false;
    }
  }

  /// Shows the preloaded interstitial ad if ready and cooldown has passed.
  /// Calls [onComplete] immediately if no ad is ready, or after the ad is dismissed.
  void showIfReady({VoidCallback? onComplete}) {
    final isPremium = _ref.read(premiumServiceProvider).isPremium;
    if (isPremium) {
      onComplete?.call();
      return;
    }

    final now = DateTime.now();
    if (_lastShownTime != null && now.difference(_lastShownTime!) < _cooldown) {
      // Cooldown active — skip to avoid disrupting the user experience
      onComplete?.call();
      return;
    }

    final ad = _interstitialAd;
    if (ad == null) {
      onComplete?.call();
      // Try to preload for next time
      unawaited(preloadAd());
      return;
    }

    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        debugPrint('AdMob Interstitial dismissed.');
        ad.dispose();
        _interstitialAd = null;
        _lastShownTime = DateTime.now();
        onComplete?.call();
        // Automatically preload the next ad
        unawaited(preloadAd());
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        debugPrint('AdMob Interstitial failed to show: ${error.message}');
        ad.dispose();
        _interstitialAd = null;
        onComplete?.call();
        unawaited(preloadAd());
      },
    );

    _interstitialAd = null; // Clear reference before showing
    ad.show();
  }

  void dispose() {
    _interstitialAd?.dispose();
    _interstitialAd = null;
  }
}
