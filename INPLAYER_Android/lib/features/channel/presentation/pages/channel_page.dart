import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_logo.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../services/channel_service.dart';
import '../../../../services/notification_badge_service.dart';
import '../../../../models/channel.dart';
import '../../../home/presentation/widgets/video_card.dart';
import '../widgets/become_member_button.dart';

class ChannelPage extends ConsumerStatefulWidget {
  final String username;

  const ChannelPage({super.key, required this.username});

  @override
  ConsumerState<ChannelPage> createState() => _ChannelPageState();
}

enum _ChannelVideoSort { mostViewed, newest, oldest }

class _ChannelPageState extends ConsumerState<ChannelPage> {
  Channel? _channel;
  bool _loading = true;
  bool _notFound = false;
  bool _subscribeBusy = false;

  _ChannelVideoSort _sort = _ChannelVideoSort.mostViewed;
  bool _searchOpen = false;
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
    _searchController.addListener(() {
      setState(() => _query = _searchController.text.trim().toLowerCase());
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // Client-side sort + filter over the channel's own video list — the same
  // approach every other listing surface in the app uses (category chips,
  // Music tab), since there's no per-channel search/sort backend endpoint
  // to call. Real, not decorative: previously these controls existed but
  // did nothing at all.
  List<ChannelVideo> _visibleVideos(Channel channel) {
    // Shorts get their own horizontal "Raftaar" shelf above this list (see
    // _buildRaftaarShelf) — excluded here so they don't also show up as
    // full-width cards in the main grid underneath it.
    var videos = channel.videos.where((v) => v.contentType != 'short').toList();
    if (_query.isNotEmpty) {
      videos = videos.where((v) => v.title.toLowerCase().contains(_query)).toList();
    } else {
      videos = List.of(videos);
    }
    switch (_sort) {
      case _ChannelVideoSort.mostViewed:
        videos.sort((a, b) => b.views.compareTo(a.views));
        break;
      case _ChannelVideoSort.newest:
        videos.sort((a, b) => (b.uploadedAt ?? '').compareTo(a.uploadedAt ?? ''));
        break;
      case _ChannelVideoSort.oldest:
        videos.sort((a, b) => (a.uploadedAt ?? '').compareTo(b.uploadedAt ?? ''));
        break;
    }
    return videos;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _notFound = false;
    });

    final service = ref.read(channelServiceProvider);
    final channel = await service.getChannel(widget.username);

    if (!mounted) return;

    if (channel == null) {
      setState(() {
        _loading = false;
        _notFound = true;
      });
      return;
    }

    final status = await service.getSubscriptionStatus(channel.creatorId);

    if (!mounted) return;

    setState(() {
      _channel = status != null
          ? channel.copyWith(
              isSubscribed: status['isSubscribed'] == true,
              subscribers: (status['subscriberCount'] as num?)?.toInt() ?? channel.subscribers,
              notifyEnabled: status['notifyEnabled'] != false,
            )
          : channel;
      _loading = false;
    });
  }

  Future<void> _toggleSubscribe() async {
    final channel = _channel;
    if (channel == null || _subscribeBusy) return;

    setState(() => _subscribeBusy = true);

    final service = ref.read(channelServiceProvider);
    final wasSubscribed = channel.isSubscribed;
    final ok = wasSubscribed
        ? await service.unsubscribeFromChannel(channel.creatorId)
        : await service.subscribeToChannel(channel.creatorId);

    if (!mounted) return;

    if (ok) {
      setState(() {
        _channel = channel.copyWith(
          isSubscribed: !wasSubscribed,
          subscribers: (channel.subscribers ?? 0) + (wasSubscribed ? -1 : 1),
        );
        _subscribeBusy = false;
      });
    } else {
      setState(() => _subscribeBusy = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              wasSubscribed
                  ? "Couldn't unsubscribe. Try again."
                  : "Couldn't subscribe. Sign in and try again.",
            ),
            backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
          ),
        );
      }
    }
  }

  Future<void> _toggleNotify() async {
    final channel = _channel;
    if (channel == null || !channel.isSubscribed) return;

    final next = !channel.notifyEnabled;
    setState(() => _channel = channel.copyWith(notifyEnabled: next));

    final ok = await ref.read(channelServiceProvider).setNotifyEnabled(channel.creatorId, next);

    if (!ok && mounted) {
      setState(() => _channel = channel.copyWith(notifyEnabled: !next));
    }
  }

  String _formatCount(int count) {
    if (count >= 1000000) return '${(count / 1000000).toStringAsFixed(1)}M';
    if (count >= 1000) return '${(count / 1000).toStringAsFixed(1)}K';
    return count.toString();
  }

  /// Full comma-grouped count — matches the website's own
  /// `(profile.subscriberCount || 0).toLocaleString()` for subscriber
  /// counts specifically (ChannelPageContent.tsx), which is deliberately
  /// NOT abbreviated the way view counts are.
  String _formatSubscriberCount(int count) {
    final digits = count.toString();
    final buffer = StringBuffer();
    for (int i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
      buffer.write(digits[i]);
    }
    return buffer.toString();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: context.bgCanvas,
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.brandOrange),
        ),
      );
    }

    if (_notFound || _channel == null) {
      return Scaffold(
        backgroundColor: context.bgCanvas,
        appBar: AppBar(
          backgroundColor: context.bgCanvas,
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.person_off_outlined, size: 48, color: context.textDim),
              const SizedBox(height: 16),
              Text(
                'No channel at @${widget.username}',
                style: TextStyle(color: context.textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    final channel = _channel!;

    if (channel.gated) {
      return Scaffold(
        backgroundColor: context.bgCanvas,
        appBar: AppBar(
          backgroundColor: context.bgCanvas,
          elevation: 0,
          title: Text('@${channel.username}', style: TextStyle(color: context.textPrimary)),
          iconTheme: IconThemeData(color: context.textPrimary),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _avatar(channel, radius: 40),
                const SizedBox(height: 16),
                Text(
                  channel.name,
                  style: GoogleFonts.plusJakartaSans(
                    color: context.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Icon(
                  channel.usernamePrivacy == 'private' ? Icons.lock_outline : Icons.people_alt_outlined,
                  size: 22,
                  color: context.textSecondary,
                ),
                const SizedBox(height: 8),
                Text(
                  channel.usernamePrivacy == 'private' ? 'This account is private' : 'This account is only visible to connections',
                  style: TextStyle(color: context.textSecondary, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  channel.usernamePrivacy == 'private'
                      ? 'Only @${channel.username} can see their channel.'
                      : 'Follow each other (mutual In-Family) to see this channel.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: context.textDim, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
        elevation: 0,
        iconTheme: IconThemeData(color: context.textPrimary),
        title: const AppLogo(height: 28),
        actions: [
          IconButton(
            icon: Icon(Icons.search, color: context.textPrimary),
            onPressed: () => context.push('/search'),
          ),
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: Icon(Icons.notifications_none, color: context.textPrimary),
                onPressed: () => context.push('/notifications'),
              ),
              // Small red-dot unread badge — matches the website's real
              // bell (NavbarActions.tsx) exactly: a plain dot, not a count.
              if (ref.watch(notificationBadgeServiceProvider.select((s) => s.unreadCount > 0)))
                Positioned(
                  right: 10,
                  top: 10,
                  child: IgnorePointer(
                    child: Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        shape: BoxShape.circle,
                        border: Border.all(color: context.bgCanvas, width: 1.5),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: PatternBackground(
        child: RefreshIndicator(
          color: AppColors.brandOrange,
          backgroundColor: context.bgCard,
          onRefresh: _load,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: _buildHeaderCard(channel),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'CHANNEL LIBRARY',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.brandOrange, letterSpacing: 1.5),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Videos',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: context.textPrimary),
                      ),
                      const SizedBox(height: 16),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _buildFilterPill(
                              'Most Viewed',
                              isActive: _sort == _ChannelVideoSort.mostViewed,
                              onTap: () => setState(() => _sort = _ChannelVideoSort.mostViewed),
                            ),
                            const SizedBox(width: 8),
                            _buildFilterPill(
                              'Newest',
                              isActive: _sort == _ChannelVideoSort.newest,
                              onTap: () => setState(() => _sort = _ChannelVideoSort.newest),
                            ),
                            const SizedBox(width: 8),
                            _buildFilterPill(
                              'Oldest',
                              isActive: _sort == _ChannelVideoSort.oldest,
                              onTap: () => setState(() => _sort = _ChannelVideoSort.oldest),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      GestureDetector(
                        onTap: () => setState(() => _searchOpen = true),
                        child: Container(
                          padding: EdgeInsets.symmetric(horizontal: 16, vertical: _searchOpen ? 4 : 12),
                          decoration: BoxDecoration(
                            color: context.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white.withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: context.borderSubtle),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.search, color: AppColors.brandOrange, size: 20),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _searchOpen
                                    ? TextField(
                                        controller: _searchController,
                                        autofocus: true,
                                        style: TextStyle(color: context.textPrimary, fontSize: 13),
                                        decoration: InputDecoration(
                                          hintText: 'Search this channel',
                                          hintStyle: TextStyle(color: context.textDim, fontSize: 13),
                                          border: InputBorder.none,
                                          isDense: true,
                                        ),
                                      )
                                    : Text(
                                        'Search this channel',
                                        style: TextStyle(color: context.textDim, fontSize: 13),
                                      ),
                              ),
                              if (_searchOpen && _query.isNotEmpty)
                                GestureDetector(
                                  onTap: () {
                                    _searchController.clear();
                                    setState(() => _searchOpen = false);
                                  },
                                  child: Icon(Icons.close, color: context.textDim, size: 18),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Builder(builder: (context) {
                // A horizontal "Raftaar" shelf for this creator's Shorts —
                // the website shows Shorts separately from long-form videos
                // on a channel page; this app previously mixed every
                // content type into one flat vertical list with no Shorts
                // presentation of its own.
                final shorts = channel.videos.where((v) => v.contentType == 'short').toList();
                if (shorts.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
                return SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(left: 16, right: 16, top: 4, bottom: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.bolt, color: AppColors.brandOrange, size: 16),
                            const SizedBox(width: 6),
                            Text(
                              'Raftaar',
                              style: TextStyle(color: context.textPrimary, fontSize: 15, fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        SizedBox(
                          height: 190,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: shorts.length,
                            separatorBuilder: (context, index) => const SizedBox(width: 10),
                            itemBuilder: (context, index) {
                              final s = shorts[index];
                              final image = (s.thumbnailUrl ?? '').isNotEmpty ? smartImageProvider(s.thumbnailUrl!) : null;
                              return GestureDetector(
                                onTap: () => context.push('/shorts/${s.videoId}'),
                                child: Container(
                                  width: 108,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(14),
                                    color: context.bgCard,
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: image != null
                                      ? Image(image: image, fit: BoxFit.cover)
                                      : Icon(Icons.play_circle_outline, color: context.textDim, size: 32),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
              Builder(builder: (context) {
                final visible = _visibleVideos(channel);
                if (visible.isEmpty) {
                  return SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 48),
                      child: Center(
                        child: Text(
                          _query.isNotEmpty ? 'No videos match "$_query"' : 'No videos yet',
                          style: TextStyle(color: context.textSecondary),
                        ),
                      ),
                    ),
                  );
                }
                return SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList.separated(
                    itemCount: visible.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 24),
                    itemBuilder: (context, index) {
                      final v = visible[index];
                      return VideoCard(
                        video: v.toVideo(
                          creatorName: channel.name,
                          creatorAvatar: channel.avatarUrl,
                          uploaderUsername: channel.username,
                          uploaderId: channel.creatorId,
                        )
                      );
                    },
                  ),
                );
              }),
              const SliverToBoxAdapter(child: SizedBox(height: 32)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterPill(String label, {bool isActive = false, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? AppColors.brandOrange.withValues(alpha: 0.12) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isActive ? AppColors.brandOrange.withValues(alpha: 0.4) : context.borderSubtle),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? AppColors.brandOrange : context.textPrimary,
            fontSize: 13,
            fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderCard(Channel channel) {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E262B),
        borderRadius: BorderRadius.circular(24),
        image: channel.coverPhotoUrl != null
            ? DecorationImage(
                image: smartImageProvider(channel.coverPhotoUrl!)!,
                fit: BoxFit.cover,
                colorFilter: ColorFilter.mode(Colors.black.withValues(alpha: 0.35), BlendMode.darken),
              )
            : null,
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
              ),
              child: _avatar(channel, radius: 32),
            ),
            const SizedBox(height: 16),
            Text(
              channel.name,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.5),
            ),
            const SizedBox(height: 4),
            Text(
              '@${channel.username}',
              style: const TextStyle(color: AppColors.brandOrangeLight, fontSize: 13, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              '${_formatSubscriberCount(channel.subscribers ?? 0)} subscribers • ${_formatCount(channel.totalViews ?? 0)} total views',
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  flex: 7,
                  child: Container(height: 4, decoration: BoxDecoration(color: AppColors.brandOrange, borderRadius: BorderRadius.circular(2))),
                ),
                const SizedBox(width: 4),
                Expanded(
                  flex: 3,
                  child: Container(height: 4, decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(2))),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // channel.isOwner tells us this is the signed-in viewer's own
            // channel (the backend already computes this) — previously
            // never checked here, so visiting your own public channel page
            // showed Subscribe/Message-yourself/Become-a-Member, none of
            // which make sense on your own channel. Now shows a single
            // real "Manage Channel" action into Creator Studio instead.
            if (channel.isOwner)
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildActionButton(
                      icon: Icons.dashboard_customize_outlined,
                      label: 'Manage Channel',
                      color: AppColors.brandOrange,
                      textColor: Colors.white,
                      onTap: () => context.push('/creator-studio'),
                    ),
                  ],
                ),
              )
            else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildActionButton(
                    icon: channel.isSubscribed ? Icons.check : Icons.rss_feed,
                    label: 'In-Family ${_formatSubscriberCount(channel.subscribers ?? 0)}',
                    color: Colors.white.withValues(alpha: 0.2),
                    textColor: Colors.white,
                    onTap: _toggleSubscribe,
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _toggleNotify,
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: channel.notifyEnabled ? AppColors.brandOrange : Colors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.notifications,
                        color: channel.notifyEnabled ? Colors.white : Colors.white70,
                        size: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  BecomeMemberButton(
                    creatorId: channel.creatorId,
                    creatorName: channel.name,
                    username: channel.username,
                  ),
                  const SizedBox(width: 8),
                  _buildActionButton(
                    icon: Icons.chat_bubble_outline,
                    label: 'Message',
                    color: Colors.white.withValues(alpha: 0.2),
                    textColor: Colors.white,
                    // Starts a real conversation with this creator (same
                    // compose flow the New Message search uses), instead of
                    // the old behavior of just dropping the viewer on the
                    // general Messages inbox with no indication of who to
                    // message.
                    onTap: () => context.push('/messages/compose', extra: {
                      'otherUserId': channel.creatorId,
                      'otherUsername': channel.username,
                      'otherAvatarUrl': channel.avatarUrl,
                    }),
                  ),
                ],
              ),
            ),
            // About — the channel's real bio, already fetched into the
            // Channel model but never actually rendered anywhere on this
            // page until now. Matches the website's own channel header,
            // which shows this text beneath the action-button row.
            if ((channel.bio ?? '').trim().isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                channel.bio!.trim(),
                style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton({required IconData icon, required String label, required Color color, required Color textColor, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          children: [
            Icon(icon, color: textColor, size: 16),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(color: textColor, fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }

  Widget _avatar(Channel channel, {required double radius}) {
    return UserAvatar(
      avatarUrl: channel.avatarUrl,
      name: channel.name,
      size: radius * 2,
      isVerified: channel.isVerified,
    );
  }
}
