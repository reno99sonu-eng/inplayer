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
import '../../../../services/platform_update_service.dart';
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

class _ChannelPageState extends ConsumerState<ChannelPage>
    with WidgetsBindingObserver {
  Channel? _channel;
  bool _loading = true;
  bool _notFound = false;
  bool _subscribeBusy = false;
  DateTime? _lastBackgroundRefresh;
  ProviderSubscription<int>? _platformUpdates;

  _ChannelVideoSort _sort = _ChannelVideoSort.mostViewed;
  bool _searchOpen = false;
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _platformUpdates = ref.listenManual<int>(platformUpdateRevisionProvider, (
      previous,
      next,
    ) {
      if (mounted && previous != next) _load();
    });
    _load();
    _searchController.addListener(() {
      setState(() => _query = _searchController.text.trim().toLowerCase());
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _platformUpdates?.close();
    _searchController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed || !mounted || _loading) return;
    final now = DateTime.now();
    if (_lastBackgroundRefresh != null &&
        now.difference(_lastBackgroundRefresh!).inSeconds < 15) {
      return;
    }
    _lastBackgroundRefresh = now;
    _load();
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
      videos = videos
          .where((v) => v.title.toLowerCase().contains(_query))
          .toList();
    } else {
      videos = List.of(videos);
    }
    switch (_sort) {
      case _ChannelVideoSort.mostViewed:
        videos.sort((a, b) => b.views.compareTo(a.views));
        break;
      case _ChannelVideoSort.newest:
        videos.sort(
          (a, b) => (b.uploadedAt ?? '').compareTo(a.uploadedAt ?? ''),
        );
        break;
      case _ChannelVideoSort.oldest:
        videos.sort(
          (a, b) => (a.uploadedAt ?? '').compareTo(b.uploadedAt ?? ''),
        );
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
              subscribers:
                  (status['subscriberCount'] as num?)?.toInt() ??
                  channel.subscribers,
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
            backgroundColor: context.isDark
                ? AppColors.surfaceDark
                : AppColors.surfaceLight,
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

    final ok = await ref
        .read(channelServiceProvider)
        .setNotifyEnabled(channel.creatorId, next);

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
          title: Text(
            '@${channel.username}',
            style: TextStyle(color: context.textPrimary),
          ),
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
                  channel.usernamePrivacy == 'private'
                      ? Icons.lock_outline
                      : Icons.people_alt_outlined,
                  size: 22,
                  color: context.textSecondary,
                ),
                const SizedBox(height: 8),
                Text(
                  channel.usernamePrivacy == 'private'
                      ? 'This account is private'
                      : 'This account is only visible to connections',
                  style: TextStyle(
                    color: context.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
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
                icon: Icon(
                  Icons.notifications_none,
                  color: context.textPrimary,
                ),
                onPressed: () => context.push('/notifications'),
              ),
              // Small red-dot unread badge — matches the website's real
              // bell (NavbarActions.tsx) exactly: a plain dot, not a count.
              if (ref.watch(
                notificationBadgeServiceProvider.select(
                  (s) => s.unreadCount > 0,
                ),
              ))
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
              SliverToBoxAdapter(child: _buildHeaderCard(channel)),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text(
                            'BROWSE LIBRARY',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: AppColors.brandOrange,
                              letterSpacing: 1.4,
                            ),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.brandOrange.withValues(
                                alpha: 0.12,
                              ),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: AppColors.brandOrange.withValues(
                                  alpha: 0.35,
                                ),
                              ),
                            ),
                            child: Text(
                              '${_visibleVideos(channel).length} videos',
                              style: GoogleFonts.plusJakartaSans(
                                color: AppColors.brandOrange,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Videos',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: context.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _buildFilterPill(
                              'Most Viewed',
                              isActive: _sort == _ChannelVideoSort.mostViewed,
                              onTap: () => setState(
                                () => _sort = _ChannelVideoSort.mostViewed,
                              ),
                            ),
                            const SizedBox(width: 8),
                            _buildFilterPill(
                              'Newest',
                              isActive: _sort == _ChannelVideoSort.newest,
                              onTap: () => setState(
                                () => _sort = _ChannelVideoSort.newest,
                              ),
                            ),
                            const SizedBox(width: 8),
                            _buildFilterPill(
                              'Oldest',
                              isActive: _sort == _ChannelVideoSort.oldest,
                              onTap: () => setState(
                                () => _sort = _ChannelVideoSort.oldest,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => setState(() => _searchOpen = true),
                          borderRadius: BorderRadius.circular(14),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            padding: EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: _searchOpen ? 4 : 10,
                            ),
                            decoration: BoxDecoration(
                              color: context.isDark
                                  ? Colors.white.withValues(alpha: 0.04)
                                  : Colors.white.withValues(alpha: 0.72),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: context.borderSubtle.withValues(
                                  alpha: 0.8,
                                ),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color:
                                      (context.isDark
                                              ? Colors.black
                                              : const Color(0xFFCBD5E1))
                                          .withValues(alpha: 0.08),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.search,
                                  color: AppColors.brandOrange,
                                  size: 18,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: _searchOpen
                                      ? TextField(
                                          controller: _searchController,
                                          autofocus: true,
                                          style: TextStyle(
                                            color: context.textPrimary,
                                            fontSize: 13,
                                          ),
                                          decoration: InputDecoration(
                                            hintText: 'Search this channel',
                                            hintStyle: TextStyle(
                                              color: context.textDim,
                                              fontSize: 13,
                                            ),
                                            border: InputBorder.none,
                                            isDense: true,
                                            contentPadding: EdgeInsets.zero,
                                          ),
                                        )
                                      : Text(
                                          'Search this channel',
                                          style: TextStyle(
                                            color: context.textDim,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                ),
                                if (_searchOpen && _query.isNotEmpty)
                                  GestureDetector(
                                    onTap: () {
                                      _searchController.clear();
                                      setState(() => _searchOpen = false);
                                    },
                                    child: Icon(
                                      Icons.close,
                                      color: context.textDim,
                                      size: 18,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Builder(
                builder: (context) {
                  // A horizontal "Raftaar" shelf for this creator's Shorts —
                  // the website shows Shorts separately from long-form videos
                  // on a channel page; this app previously mixed every
                  // content type into one flat vertical list with no Shorts
                  // presentation of its own.
                  final shorts = channel.videos
                      .where((v) => v.contentType == 'short')
                      .toList();
                  if (shorts.isEmpty) {
                    return const SliverToBoxAdapter(child: SizedBox.shrink());
                  }
                  return SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(
                        left: 16,
                        right: 16,
                        top: 6,
                        bottom: 8,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.bolt_rounded,
                                color: AppColors.brandOrange,
                                size: 16,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'Raftaar',
                                style: TextStyle(
                                  color: context.textPrimary,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          SizedBox(
                            height: 172,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: shorts.length,
                              separatorBuilder: (context, index) =>
                                  const SizedBox(width: 10),
                              itemBuilder: (context, index) {
                                final s = shorts[index];
                                final image = (s.thumbnailUrl ?? '').isNotEmpty
                                    ? smartImageProvider(s.thumbnailUrl!)
                                    : null;
                                return Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    onTap: () =>
                                        context.push('/shorts/${s.videoId}'),
                                    borderRadius: BorderRadius.circular(14),
                                    child: Ink(
                                      width: 108,
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(14),
                                        color: context.bgCard,
                                        border: Border.all(
                                          color: context.borderSubtle
                                              .withValues(alpha: 0.5),
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color:
                                                (context.isDark
                                                        ? Colors.black
                                                        : const Color(
                                                            0xFFCBD5E1,
                                                          ))
                                                    .withValues(alpha: 0.12),
                                            blurRadius: 12,
                                            offset: const Offset(0, 4),
                                          ),
                                        ],
                                      ),
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(14),
                                        child: image != null
                                            ? Image(
                                                image: image,
                                                fit: BoxFit.cover,
                                              )
                                            : Icon(
                                                Icons.play_circle_outline,
                                                color: context.textDim,
                                                size: 32,
                                              ),
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              Builder(
                builder: (context) {
                  final visible = _visibleVideos(channel);
                  if (visible.isEmpty) {
                    return SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 48),
                        child: Center(
                          child: Text(
                            _query.isNotEmpty
                                ? 'No videos match "$_query"'
                                : 'No videos yet',
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
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 14),
                      itemBuilder: (context, index) {
                        final v = visible[index];
                        return VideoCard(
                          video: v.toVideo(
                            creatorName: channel.name,
                            creatorAvatar: channel.avatarUrl,
                            uploaderUsername: channel.username,
                            uploaderId: channel.creatorId,
                          ),
                          isChannelProfile: true,
                        );
                      },
                    ),
                  );
                },
              ),
              Builder(
                builder: (context) {
                  if ((channel.bio ?? '').trim().isEmpty) {
                    return const SliverToBoxAdapter(
                      child: SizedBox(height: 32),
                    );
                  }
                  return SliverToBoxAdapter(
                    child: Container(
                      margin: const EdgeInsets.fromLTRB(16, 0, 16, 28),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: context.isDark
                            ? Colors.white.withValues(alpha: 0.035)
                            : Colors.black.withValues(alpha: 0.025),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: context.borderSubtle.withValues(alpha: 0.5),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'ABOUT',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: AppColors.brandOrange,
                              letterSpacing: 2,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            channel.bio!.trim(),
                            style: TextStyle(
                              color: context.textSecondary,
                              fontSize: 13,
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterPill(
    String label, {
    bool isActive = false,
    VoidCallback? onTap,
  }) {
    return AnimatedScale(
      scale: 1.0,
      duration: const Duration(milliseconds: 150),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: isActive
                  ? AppColors.brandOrange.withValues(alpha: 0.12)
                  : context.isDark
                  ? Colors.white.withValues(alpha: 0.02)
                  : Colors.black.withValues(alpha: 0.015),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: isActive
                    ? AppColors.brandOrange.withValues(alpha: 0.45)
                    : context.borderSubtle.withValues(alpha: 0.7),
              ),
              boxShadow: isActive
                  ? [
                      BoxShadow(
                        color: AppColors.brandOrange.withValues(alpha: 0.12),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ]
                  : null,
            ),
            child: Text(
              label,
              style: TextStyle(
                color: isActive ? AppColors.brandOrange : context.textPrimary,
                fontSize: 12.5,
                fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderCard(Channel channel) {
    final isDark = context.isDark;
    final coverImage = channel.coverPhotoUrl != null
        ? DecorationImage(
            image: smartImageProvider(channel.coverPhotoUrl!)!,
            fit: BoxFit.cover,
            colorFilter: ColorFilter.mode(
              Colors.black.withValues(alpha: isDark ? 0.20 : 0.12),
              BlendMode.darken,
            ),
          )
        : null;

    final statsText =
        '${_formatSubscriberCount(channel.subscribers ?? 0)} subscribers • ${_formatCount(channel.totalViews ?? 0)} total views';

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF181F29) : const Color(0xFFF7F7F8),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: context.borderSubtle.withValues(alpha: 0.7)),
        boxShadow: [
          BoxShadow(
            color: (isDark ? Colors.black : const Color(0xFFCBD5E1)).withValues(
              alpha: 0.14,
            ),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                height: 144,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: isDark
                        ? const [
                            Color(0xFF1F2937),
                            Color(0xFF0F172A),
                            Color(0xFF111827),
                          ]
                        : const [
                            Color(0xFFFFEDD5),
                            Color(0xFFF7F7F8),
                            Color(0xFFE2E8F0),
                          ],
                  ),
                  image: coverImage,
                ),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        isDark
                            ? Colors.black.withValues(alpha: 0.22)
                            : Colors.white.withValues(alpha: 0.12),
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 18,
                bottom: -24,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isDark
                        ? const Color(0xFF181F29)
                        : const Color(0xFFF7F7F8),
                    boxShadow: [
                      BoxShadow(
                        color: (isDark ? Colors.black : AppColors.brandOrange)
                            .withValues(alpha: 0.18),
                        blurRadius: 14,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: _avatar(channel, radius: 28),
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Text(
                        channel.name,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: context.textPrimary,
                          letterSpacing: -0.7,
                        ),
                      ),
                    ),
                    if (channel.isVerified)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.brandOrange.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: AppColors.brandOrange.withValues(
                              alpha: 0.35,
                            ),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.verified_rounded,
                              size: 13,
                              color: AppColors.brandOrange,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Verified',
                              style: GoogleFonts.plusJakartaSans(
                                color: AppColors.brandOrange,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '@${channel.username}',
                  style: GoogleFonts.plusJakartaSans(
                    color: AppColors.brandOrange,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildStatChip(
                      'Followers',
                      _formatSubscriberCount(channel.subscribers ?? 0),
                    ),
                    _buildStatChip(
                      'Views',
                      _formatCount(channel.totalViews ?? 0),
                    ),
                    _buildStatChip(
                      'Videos',
                      '${channel.videoCount ?? channel.videos.length}',
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  statsText,
                  style: GoogleFonts.plusJakartaSans(
                    color: context.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if ((channel.bio ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.04)
                          : Colors.black.withValues(alpha: 0.03),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: context.borderSubtle.withValues(alpha: 0.6),
                      ),
                    ),
                    child: Text(
                      channel.bio!.trim(),
                      style: GoogleFonts.plusJakartaSans(
                        color: context.textSecondary,
                        fontSize: 12.5,
                        height: 1.5,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                if (channel.isOwner)
                  _buildProfileActions(
                    children: [
                      _buildActionButton(
                        icon: Icons.dashboard_customize_outlined,
                        label: 'Manage Channel',
                        fill: true,
                        color: AppColors.brandOrange,
                        textColor: Colors.white,
                        onTap: () => context.push('/creator-studio'),
                      ),
                    ],
                  )
                else
                  _buildProfileActions(
                    children: [
                      _buildActionButton(
                        icon: channel.isSubscribed
                            ? Icons.check_rounded
                            : Icons.people_alt_outlined,
                        label: channel.isSubscribed ? 'Following' : 'Follow',
                        fill: !channel.isSubscribed,
                        color: channel.isSubscribed
                            ? context.isDark
                                  ? const Color(0xFF1E2A38)
                                  : const Color(0xFFE5E7EB)
                            : AppColors.brandOrange,
                        textColor: channel.isSubscribed
                            ? context.textPrimary
                            : Colors.white,
                        onTap: _toggleSubscribe,
                      ),
                      _buildActionButton(
                        icon: channel.notifyEnabled
                            ? Icons.notifications_active_rounded
                            : Icons.notifications_none_rounded,
                        label: channel.notifyEnabled
                            ? 'Alerts on'
                            : 'Alerts off',
                        fill: false,
                        color: isDark
                            ? const Color(0xFF0F172A)
                            : const Color(0xFFFFFFFF),
                        textColor: context.textPrimary,
                        onTap: _toggleNotify,
                      ),
                      BecomeMemberButton(
                        creatorId: channel.creatorId,
                        creatorName: channel.name,
                        username: channel.username,
                      ),
                      _buildActionButton(
                        icon: Icons.chat_bubble_outline_rounded,
                        label: 'Message',
                        fill: false,
                        color: isDark
                            ? const Color(0xFF0F172A)
                            : const Color(0xFFFFFFFF),
                        textColor: context.textPrimary,
                        onTap: () => context.push(
                          '/messages/compose',
                          extra: {
                            'otherUserId': channel.creatorId,
                            'otherUsername': channel.username,
                            'otherAvatarUrl': channel.avatarUrl,
                          },
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: context.isDark
            ? Colors.white.withValues(alpha: 0.04)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: context.borderSubtle.withValues(alpha: 0.6)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              color: context.textDim,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(
              color: context.textPrimary,
              fontSize: 10,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileActions({required List<Widget> children}) {
    return Wrap(spacing: 8, runSpacing: 8, children: children);
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required bool fill,
    required Color color,
    required Color textColor,
    VoidCallback? onTap,
  }) {
    final button = AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: fill ? color : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: fill
              ? Colors.transparent
              : context.borderSubtle.withValues(alpha: 0.8),
        ),
        boxShadow: fill
            ? [
                BoxShadow(
                  color: color.withValues(alpha: 0.18),
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ]
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: textColor, size: 15),
          const SizedBox(width: 7),
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              color: textColor,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: button,
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
