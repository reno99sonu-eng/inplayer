import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../services/ad_service.dart';

/// Real house ad card for the home feed's "home" placement — mirrors
/// AdCard.tsx / app/api/ads/route.ts. Fires an impression once the real
/// creative loads, and a click event when tapped, same as the website.
/// Renders nothing when there's no active house creative for this
/// placement (off, AdSense-only, or nothing scheduled right now) — no
/// fake/placeholder ad is ever shown.
class HomeAdCard extends ConsumerStatefulWidget {
  const HomeAdCard({super.key});

  @override
  ConsumerState<HomeAdCard> createState() => _HomeAdCardState();
}

class _HomeAdCardState extends ConsumerState<HomeAdCard> {
  AdCreative? _ad;
  bool _impressionSent = false;

  @override
  void initState() {
    super.initState();
    _loadAd();
  }

  Future<void> _loadAd() async {
    final ad = await ref.read(adServiceProvider).getAd('home');
    if (!mounted) return;
    setState(() => _ad = ad);
    if (ad != null && !_impressionSent) {
      _impressionSent = true;
      ref.read(adServiceProvider).trackEvent(ad.adId, event: 'impression');
    }
  }

  Future<void> _onTap() async {
    final ad = _ad;
    if (ad == null) return;
    ref.read(adServiceProvider).trackEvent(ad.adId, event: 'click');
    final uri = Uri.tryParse(ad.linkUrl);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.inAppWebView);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ad = _ad;
    if (ad == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GestureDetector(
        onTap: _onTap,
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
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'Sponsored',
                    style: TextStyle(color: Colors.white70, fontSize: 9, fontWeight: FontWeight.w600),
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
                        colors: [Colors.black.withValues(alpha: 0.75), Colors.transparent],
                      ),
                    ),
                    child: Text(
                      ad.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
