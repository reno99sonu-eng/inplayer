import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../models/trending_creator.dart';
import '../../../../services/video_service.dart';

class TrendingNowRow extends ConsumerStatefulWidget {
  /// Bumped by the home feed on every pull-to-refresh.
  ///
  /// Without this the row fetched exactly once, in initState, and never
  /// again — and because it lives inside HomePage's IndexedStack it is built
  /// once and then kept alive for the whole session, so pull-to-refresh
  /// reloaded the video feed around it while this row went on showing
  /// whatever ranking happened to be current when the app was first opened.
  /// The website's /api/trending is `force-dynamic` and recomputes today's
  /// ranking on every single request, so a long-lived session could sit on a
  /// ranking hours or days stale. That is the "trending creators not syncing
  /// properly" report — the fetch and the parsing were both already correct.
  final int refreshToken;

  const TrendingNowRow({super.key, this.refreshToken = 0});

  @override
  ConsumerState<TrendingNowRow> createState() => _TrendingNowRowState();
}

class _TrendingNowRowState extends ConsumerState<TrendingNowRow> {
  List<TrendingCreator> _creators = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadCreators();
  }

  @override
  void didUpdateWidget(covariant TrendingNowRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshToken != widget.refreshToken) {
      // Deliberately does not flip _isLoading back to true: swapping a
      // populated row out for shimmer placeholders on every pull-to-refresh
      // reads as the content vanishing. The current creators stay on screen
      // until the new ones land.
      _loadCreators();
    }
  }

  Future<void> _loadCreators() async {
    try {
      final videoService = ref.read(videoServiceProvider);
      final creators = await videoService.getTrendingCreatorsData();
      if (mounted) {
        setState(() {
          _creators = creators;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  String _formatViews(int views) {
    if (views >= 1000000) {
      return '${(views / 1000000).toStringAsFixed(1)}M';
    } else if (views >= 1000) {
      return '${(views / 1000).toStringAsFixed(1)}K';
    }
    return views.toString();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isLoading && _creators.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.withValues(alpha: 0.25)),
                ),
                child: const Text(
                  '🔥 TRENDING NOW',
                  style: TextStyle(
                    color: Colors.redAccent,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Trending Creators',
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 115,
            child: _isLoading
                ? _buildLoading(context)
                : ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: _creators.length,
                    itemBuilder: (context, index) {
                      final creator = _creators[index];
                      return _buildCreatorCard(context, creator);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoading(BuildContext context) {
    return ListView.builder(
      scrollDirection: Axis.horizontal,
      itemCount: 5,
      itemBuilder: (context, index) {
        return Container(
          width: 80,
          margin: const EdgeInsets.only(right: 12),
          child: Column(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: context.isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.06),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                width: 48,
                height: 8,
                decoration: BoxDecoration(
                  color: context.isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildCreatorCard(BuildContext context, TrendingCreator creator) {
    return GestureDetector(
      onTap: () {
        if (creator.username.isNotEmpty) {
          context.push('/channel/${Uri.encodeComponent(creator.username)}');
        }
      },
      child: Container(
        width: 80,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            UserAvatar(
              avatarUrl: creator.avatarUrl,
              name: creator.name,
              size: 64,
              isVerified: creator.isVerified,
            ),
            const SizedBox(height: 6),
            Text(
              creator.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '${_formatViews(creator.windowViews)} views',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: context.textSecondary,
                fontSize: 9,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
