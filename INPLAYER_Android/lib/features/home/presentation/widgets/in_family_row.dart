import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../models/channel.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/channel_service.dart';
import 'trending_now_row.dart';

/// Home-feed replacement for the old always-"Trending Creators" strip.
/// Signed-in users see their real In-Family (subscribed creators, from
/// GET /api/subscriptions/list via [ChannelService.getSubscribedChannels] —
/// the same relationship the subscribe button writes to and the drawer's
/// old IN-FAMILY panel used to read). Signed-out users, and signed-in users
/// with no subscriptions yet, fall back to the existing public
/// [TrendingNowRow] discovery strip rather than showing fabricated data —
/// mirrors the website's InFamilyHome.tsx exactly.
class InFamilyRow extends ConsumerStatefulWidget {
  final int refreshToken;

  const InFamilyRow({super.key, this.refreshToken = 0});

  @override
  ConsumerState<InFamilyRow> createState() => _InFamilyRowState();
}

class _InFamilyRowState extends ConsumerState<InFamilyRow> {
  List<Channel>? _subscriptions;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant InFamilyRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshToken != widget.refreshToken) {
      _load();
    }
  }

  Future<void> _load() async {
    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      if (mounted) {
        setState(() {
          _subscriptions = null;
          _isLoading = false;
        });
      }
      return;
    }

    try {
      final subs = await ref.read(channelServiceProvider).getSubscribedChannels();
      if (mounted) {
        setState(() {
          _subscriptions = subs;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _subscriptions = [];
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final signedIn = authState is AuthStateAuthenticated;

    if (!signedIn) {
      return TrendingNowRow(refreshToken: widget.refreshToken);
    }

    if (_isLoading) {
      return const SizedBox(height: 115);
    }

    final subs = _subscriptions ?? [];

    if (subs.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'In-Family',
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: context.isDark
                    ? Colors.white.withValues(alpha: 0.04)
                    : Colors.black.withValues(alpha: 0.03),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: context.borderSubtle),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Your In-Family is empty',
                          style: TextStyle(
                            color: context.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Follow creators to see them here.',
                          style: TextStyle(color: context.textDim, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => context.push('/creators'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.brandOrange,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Text(
                        'Discover',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'In-Family',
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 100,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: subs.length,
              itemBuilder: (context, index) {
                final channel = subs[index];
                return GestureDetector(
                  onTap: () {
                    if (channel.username.isNotEmpty) {
                      context.push('/channel/${Uri.encodeComponent(channel.username)}');
                    }
                  },
                  child: Container(
                    width: 76,
                    margin: const EdgeInsets.only(right: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        UserAvatar(
                          avatarUrl: channel.avatarUrl,
                          name: channel.name,
                          size: 60,
                          isVerified: channel.isVerified,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          channel.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: context.textPrimary,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
