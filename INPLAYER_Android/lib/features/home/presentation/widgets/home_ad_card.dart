import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../services/ad_service.dart';
import '../../../../services/admob_consent_service.dart';

/// Home feed ad slot. It serves the configured Google banner when AdMob is
/// enabled and consent allows requests, and falls back to the existing house
/// creative if Google has no fill or the SDK cannot load.
class HomeAdCard extends ConsumerStatefulWidget {
  const HomeAdCard({super.key});

  @override
  ConsumerState<HomeAdCard> createState() => _HomeAdCardState();
}

class _HomeAdCardState extends ConsumerState<HomeAdCard> {
  AdCreative? _ad;
  bool _impressionSent = false;
  bool _adMobFailed = false;

  @override
  void initState() {
    super.initState();
    unawaited(_loadHouseAd());
  }

  Future<void> _loadHouseAd() async {
    // The website's public ad endpoint calls this placement "homepage".
    final ad = await ref.read(adServiceProvider).getAd('homepage');
    if (!mounted) return;
    setState(() => _ad = ad);
    if (ad != null && !_impressionSent) {
      _impressionSent = true;
      unawaited(
        ref.read(adServiceProvider).trackEvent(ad.adId, event: 'impression'),
      );
    }
  }

  Future<void> _onTapHouseAd() async {
    final ad = _ad;
    if (ad == null) return;
    unawaited(ref.read(adServiceProvider).trackEvent(ad.adId, event: 'click'));
    final uri = Uri.tryParse(ad.linkUrl);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.inAppWebView);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = ref.watch(admobConfigProvider);
    ref.listen<AdMobConfig>(admobConfigProvider, (previous, next) {
      if (_adMobFailed && next.bannerUnitId != previous?.bannerUnitId) {
        setState(() => _adMobFailed = false);
      }
    });

    if (config.enabled && config.bannerUnitId.isNotEmpty && !_adMobFailed) {
      return _AdMobBannerSlot(
        key: ValueKey(config.bannerUnitId),
        adUnitId: config.bannerUnitId,
        onFailedToLoad: () {
          if (!mounted) return;
          setState(() => _adMobFailed = true);
        },
      );
    }

    final ad = _ad;
    if (ad == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 840),
          child: GestureDetector(
            onTap: _onTapHouseAd,
            child: Container(
              clipBehavior: Clip.hardEdge,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: context.bgSurface,
                border: Border.all(color: context.borderSubtle),
              ),
              child: Stack(
                children: [
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: CachedNetworkImage(
                      imageUrl: ad.imageUrl,
                      fit: BoxFit.cover,
                      errorWidget: (context, url, error) =>
                          Container(color: context.bgSurface),
                    ),
                  ),
                  Positioned(
                    left: 8,
                    top: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Sponsored',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  if (ad.title.isNotEmpty)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(10, 16, 10, 8),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: [
                              Colors.black.withValues(alpha: 0.75),
                              Colors.transparent,
                            ],
                          ),
                        ),
                        child: Text(
                          ad.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AdMobBannerSlot extends ConsumerStatefulWidget {
  const _AdMobBannerSlot({
    required this.adUnitId,
    required this.onFailedToLoad,
    super.key,
  });

  final String adUnitId;
  final VoidCallback onFailedToLoad;

  @override
  ConsumerState<_AdMobBannerSlot> createState() => _AdMobBannerSlotState();
}

class _AdMobBannerSlotState extends ConsumerState<_AdMobBannerSlot> {
  static const _testBannerUnitId = 'ca-app-pub-3940256099942544/9214589741';

  BannerAd? _banner;
  BannerAd? _loadingBanner;
  int? _requestedWidth;
  int _requestGeneration = 0;
  bool _failureReported = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final screenWidth = MediaQuery.sizeOf(context).width - 32;
    final width = math.min(screenWidth, 840.0).floor();
    if (width > 0 && width != _requestedWidth) {
      _requestedWidth = width;
      unawaited(_loadBanner(width));
    }
  }

  Future<void> _loadBanner(int width) async {
    final generation = ++_requestGeneration;
    final oldBanner = _banner;
    final oldLoadingBanner = _loadingBanner;
    _banner = null;
    _loadingBanner = null;
    if (oldBanner != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(oldBanner.dispose());
      });
    }
    if (oldLoadingBanner != null) unawaited(oldLoadingBanner.dispose());

    try {
      final canRequestAds = await ref
          .read(admobConsentServiceProvider)
          .initialize();
      if (!mounted || generation != _requestGeneration) return;
      if (!canRequestAds) {
        _reportFailure();
        return;
      }

      final size = await AdSize.getLargeAnchoredAdaptiveBannerAdSize(width);
      if (!mounted || generation != _requestGeneration) return;
      if (size == null) {
        _reportFailure();
        return;
      }

      final ad = BannerAd(
        adUnitId: kReleaseMode ? widget.adUnitId : _testBannerUnitId,
        request: const AdRequest(),
        size: size,
        listener: BannerAdListener(
          onAdLoaded: (loadedAd) {
            if (!mounted || generation != _requestGeneration) {
              unawaited(loadedAd.dispose());
              return;
            }
            _loadingBanner = null;
            setState(() => _banner = loadedAd as BannerAd);
          },
          onAdFailedToLoad: (failedAd, error) {
            unawaited(failedAd.dispose());
            if (generation == _requestGeneration) {
              _loadingBanner = null;
              _reportFailure();
            }
          },
        ),
      );
      _loadingBanner = ad;
      await ad.load();
    } catch (error) {
      debugPrint('AdMob home banner warning: $error');
      if (generation == _requestGeneration) _reportFailure();
    }
  }

  void _reportFailure() {
    if (_failureReported || !mounted) return;
    _failureReported = true;
    widget.onFailedToLoad();
  }

  @override
  void didUpdateWidget(covariant _AdMobBannerSlot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.adUnitId != widget.adUnitId) {
      _requestedWidth = null;
      _failureReported = false;
    }
  }

  @override
  void dispose() {
    _requestGeneration++;
    final banner = _banner;
    final loadingBanner = _loadingBanner;
    if (banner != null) unawaited(banner.dispose());
    if (loadingBanner != null) unawaited(loadingBanner.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final banner = _banner;
    if (banner == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 840),
          child: SizedBox(
            width: banner.size.width.toDouble(),
            height: banner.size.height.toDouble(),
            child: AdWidget(ad: banner),
          ),
        ),
      ),
    );
  }
}
