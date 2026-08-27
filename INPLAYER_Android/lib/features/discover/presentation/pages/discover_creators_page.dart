import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../models/public_creator.dart';
import '../../../../services/channel_service.dart';
import '../../../channel/presentation/widgets/become_member_button.dart';

/// Browse public InPlayer profiles and subscribe — the real equivalent of
/// the website's app/creators (Discover Creators), reached from a button
/// in the hamburger drawer's IN-FAMILY empty state that used to point at a
/// route ('/explore') which didn't exist anywhere in the app.
class DiscoverCreatorsPage extends ConsumerStatefulWidget {
  const DiscoverCreatorsPage({super.key});

  @override
  ConsumerState<DiscoverCreatorsPage> createState() => _DiscoverCreatorsPageState();
}

class _DiscoverCreatorsPageState extends ConsumerState<DiscoverCreatorsPage> {
  final List<PublicCreator> _creators = [];
  String? _cursor;
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = false;

  @override
  void initState() {
    super.initState();
    _loadFirstPage();
  }

  Future<void> _loadFirstPage() async {
    final page = await ref.read(channelServiceProvider).getCreators();
    if (!mounted) return;
    setState(() {
      _creators
        ..clear()
        ..addAll(page.creators);
      _cursor = page.nextCursor;
      _hasMore = page.nextCursor != null;
      _loading = false;
    });
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore || _cursor == null) return;
    setState(() => _loadingMore = true);
    final page = await ref.read(channelServiceProvider).getCreators(cursor: _cursor);
    if (!mounted) return;
    setState(() {
      _creators.addAll(page.creators);
      _cursor = page.nextCursor;
      _hasMore = page.nextCursor != null;
      _loadingMore = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        title: Text(
          'Discover Creators',
          style: TextStyle(fontWeight: FontWeight.w800, color: context.textPrimary, fontSize: 20),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
          : _creators.isEmpty
              ? _buildEmptyState()
              : RefreshIndicator(
                  color: AppColors.brandOrange,
                  onRefresh: _loadFirstPage,
                  child: GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.68,
                    ),
                    itemCount: _creators.length + (_hasMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index >= _creators.length) {
                        if (!_loadingMore) {
                          WidgetsBinding.instance.addPostFrameCallback((_) => _loadMore());
                        }
                        return const Center(child: CircularProgressIndicator(color: AppColors.brandOrange, strokeWidth: 2));
                      }
                      return _CreatorCard(creator: _creators[index]);
                    },
                  ),
                ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.person_search_outlined, size: 56, color: context.textDim),
            const SizedBox(height: 16),
            Text(
              'No public creators yet',
              style: TextStyle(color: context.textPrimary, fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              'Nobody with a public profile has joined InPlayer yet — check back soon.',
              textAlign: TextAlign.center,
              style: TextStyle(color: context.textSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class _CreatorCard extends ConsumerStatefulWidget {
  final PublicCreator creator;
  const _CreatorCard({required this.creator});

  @override
  ConsumerState<_CreatorCard> createState() => _CreatorCardState();
}

class _CreatorCardState extends ConsumerState<_CreatorCard> {
  bool? _isSubscribed;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    final status = await ref.read(channelServiceProvider).getSubscriptionStatus(widget.creator.userId);
    if (!mounted || status == null) return;
    setState(() => _isSubscribed = status['isSubscribed'] == true);
  }

  Future<void> _toggleSubscribe() async {
    if (_busy || _isSubscribed == null) return;
    final wasSubscribed = _isSubscribed!;
    setState(() {
      _busy = true;
      _isSubscribed = !wasSubscribed;
    });

    final service = ref.read(channelServiceProvider);
    final ok = wasSubscribed
        ? await service.unsubscribeFromChannel(widget.creator.userId)
        : await service.subscribeToChannel(widget.creator.userId);

    if (!mounted) return;
    setState(() {
      _busy = false;
      if (!ok) _isSubscribed = wasSubscribed;
    });
  }

  @override
  Widget build(BuildContext context) {
    final creator = widget.creator;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.isDark ? Colors.white.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.02),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            onTap: () => context.push('/channel/${creator.username}'),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                UserAvatar(avatarUrl: creator.avatarUrl, name: creator.name, size: 60, isVerified: false),
                const SizedBox(height: 10),
                Text(
                  creator.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: context.textPrimary, fontSize: 13.5, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '@${creator.username}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: context.textSecondary, fontSize: 11.5),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 32,
            child: _isSubscribed == null
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandOrange),
                  )
                : OutlinedButton(
                    onPressed: _busy ? null : _toggleSubscribe,
                    style: OutlinedButton.styleFrom(
                      padding: EdgeInsets.zero,
                      backgroundColor: _isSubscribed! ? Colors.transparent : AppColors.brandOrange,
                      side: BorderSide(color: _isSubscribed! ? context.borderSubtle : Colors.transparent),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Text(
                      _isSubscribed! ? 'Subscribed' : 'Subscribe',
                      style: TextStyle(
                        color: _isSubscribed! ? context.textPrimary : Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
          ),
          const SizedBox(height: 8),
          BecomeMemberButton(
            creatorId: creator.userId,
            creatorName: creator.name,
            username: creator.username,
            compact: true,
          ),
        ],
      ),
    );
  }
}
