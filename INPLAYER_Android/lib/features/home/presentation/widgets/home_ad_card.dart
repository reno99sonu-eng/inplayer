// ignore_for_file: deprecated_member_use
import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../services/ad_service.dart';
import '../../../../services/admob_consent_service.dart';

/// Home feed ad slot styled and shaped exactly like a video thumbnail card.
///
/// Serves Google AdMob Native Advanced (medium template) when enabled,
/// and falls back gracefully to standard adaptive banner or the video-shaped
/// house creative if Google has no fill or the SDK cannot load.
class HomeAdCard extends ConsumerStatefulWidget {
  const HomeAdCard({super.key});

  @override
  ConsumerState<HomeAdCard> createState() => _HomeAdCardState();
}

class _HomeAdCardState extends ConsumerState<HomeAdCard> {
  AdCreative? _ad;
  bool _impressionSent = false;
  bool _nativeFailed = false;
  bool _bannerFailed = false;

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
      if ((_nativeFailed || _bannerFailed) &&
          (next.nativeUnitId != previous?.nativeUnitId ||
              next.bannerUnitId != previous?.bannerUnitId)) {
        setState(() {
          _nativeFailed = false;
          _bannerFailed = false;
        });
      }
    });

    final hasNativeUnit =
        config.nativeUnitId.isNotEmpty || !kReleaseMode;
    final hasBannerUnit = config.bannerUnitId.isNotEmpty;

    // 1. Try Native Advanced ad format (medium template looks like a video card)
    if (config.enabled && hasNativeUnit && !_nativeFailed) {
      return _AdMobNativeCardSlot(
        key: ValueKey('native-${config.nativeUnitId}'),
        adUnitId: config.nativeUnitId,
        onFailedToLoad: () {
          if (!mounted) return;
          setState(() => _nativeFailed = true);
        },
      );
    }

    // 2. Fall back to Adaptive Banner if native failed or not configured
    if (config.enabled && hasBannerUnit && !_bannerFailed) {
      return _AdMobBannerSlot(
        key: ValueKey('banner-${config.bannerUnitId}'),
        adUnitId: config.bannerUnitId,
        onFailedToLoad: () {
          if (!mounted) return;
          setState(() => _bannerFailed = true);
        },
      );
    }

    // 3. Fall back to House Ad styled like a VideoCard
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Stack(
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
                        right: 8,
                        top: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.8),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                              color:
                                  AppColors.brandOrange.withValues(alpha: 0.5),
                            ),
                          ),
                          child: const Text(
                            'Ad',
                            style: TextStyle(
                              color: AppColors.brandOrange,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.brandOrange
                                .withValues(alpha: 0.15),
                            border: Border.all(
                              color: AppColors.brandOrange
                                  .withValues(alpha: 0.4),
                            ),
                          ),
                          child: const Center(
                            child: Text(
                              'Ad',
                              style: TextStyle(
                                color: AppColors.brandOrange,
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                ad.title.isNotEmpty ? ad.title : 'Sponsored',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: context.textPrimary,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'Sponsored',
                                style: TextStyle(
                                  color: context.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
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

/// Native Advanced Ad slot styled with Google's medium template to look
/// like a video thumbnail card sitting inline between videos in the feed.
class _AdMobNativeCardSlot extends ConsumerStatefulWidget {
  const _AdMobNativeCardSlot({
    required this.adUnitId,
    required this.onFailedToLoad,
    super.key,
  });

  final String adUnitId;
  final VoidCallback onFailedToLoad;

  @override
  ConsumerState<_AdMobNativeCardSlot> createState() =>
      _AdMobNativeCardSlotState();
}

class _AdMobNativeCardSlotState extends ConsumerState<_AdMobNativeCardSlot> {
  static const _testNativeUnitId = 'ca-app-pub-3940256099942544/2247696110';

  NativeAd? _nativeAd;
  bool _isLoaded = false;
  bool _failed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_nativeAd == null && !_failed) {
      unawaited(_loadNativeAd());
    }
  }

  Future<void> _loadNativeAd() async {
    try {
      final canRequestAds =
          await ref.read(admobConsentServiceProvider).initialize();
      if (!mounted || !canRequestAds) {
        _reportFailure();
        return;
      }

      final unitId = kReleaseMode && widget.adUnitId.isNotEmpty
          ? widget.adUnitId
          : _testNativeUnitId;

      final isDark = Theme.of(context).brightness == Brightness.dark;

      final ad = NativeAd(
        adUnitId: unitId,
        request: const AdRequest(),
        nativeTemplateStyle: NativeTemplateStyle(
          templateType: TemplateType.medium,
          mainBackgroundColor:
              isDark ? const Color(0xFF141824) : Colors.white,
          cornerRadius: 14.0,
          callToActionTextStyle: NativeTemplateTextStyle(
            textColor: Colors.white,
            backgroundColor: AppColors.brandOrange,
            style: NativeTemplateFontStyle.bold,
            size: 14.0,
          ),
          primaryTextStyle: NativeTemplateTextStyle(
            textColor: isDark ? Colors.white : Colors.black87,
            style: NativeTemplateFontStyle.bold,
            size: 14.0,
          ),
          secondaryTextStyle: NativeTemplateTextStyle(
            textColor: isDark ? const Color(0xFF94A3B8) : Colors.black54,
            size: 12.0,
          ),
          tertiaryTextStyle: NativeTemplateTextStyle(
            textColor: isDark ? const Color(0xFF64748B) : Colors.black45,
            size: 11.0,
          ),
        ),
        listener: NativeAdListener(
          onAdLoaded: (loadedAd) {
            if (!mounted) {
              unawaited(loadedAd.dispose());
              return;
            }
            setState(() {
              _nativeAd = loadedAd as NativeAd;
              _isLoaded = true;
            });
          },
          onAdFailedToLoad: (failedAd, error) {
            debugPrint('AdMob Native ad failed to load: $error');
            unawaited(failedAd.dispose());
            if (mounted) {
              _reportFailure();
            }
          },
        ),
      );

      await ad.load();
    } catch (e) {
      debugPrint('AdMob Native load warning: $e');
      _reportFailure();
    }
  }

  void _reportFailure() {
    if (_failed || !mounted) return;
    _failed = true;
    widget.onFailedToLoad();
  }

  @override
  void dispose() {
    final ad = _nativeAd;
    if (ad != null) unawaited(ad.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ad = _nativeAd;
    if (!_isLoaded || ad == null) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            maxWidth: 840,
            minHeight: 320,
            maxHeight: 360,
          ),
          child: Container(
            clipBehavior: Clip.hardEdge,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: context.bgSurface,
              border: Border.all(color: context.borderSubtle),
            ),
            child: AdWidget(ad: ad),
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

      final size = await AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(width) ??
          AdSize.banner;
      if (!mounted || generation != _requestGeneration) return;

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
