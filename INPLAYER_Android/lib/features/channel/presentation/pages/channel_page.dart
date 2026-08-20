import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../services/channel_service.dart';
import '../../../../models/channel.dart';
import '../../../home/presentation/widgets/video_card.dart';

class ChannelPage extends ConsumerStatefulWidget {
  final String username;

  const ChannelPage({super.key, required this.username});

  @override
  ConsumerState<ChannelPage> createState() => _ChannelPageState();
}

class _ChannelPageState extends ConsumerState<ChannelPage> {
  Channel? _channel;
  bool _loading = true;
  bool _notFound = false;
  bool _subscribeBusy = false;

  @override
  void initState() {
    super.initState();
    _load();
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

    // The profile endpoint itself only reports isSubscribed for a viewer it
    // can authenticate — the dedicated subscriptions endpoint is the same
    // source of truth the website's own subscribe button uses, so re-check
    // it explicitly rather than trusting a stale/omitted flag.
    final status = await service.getSubscriptionStatus(channel.creatorId);

    if (!mounted) return;

    setState(() {
      _channel = status != null
          ? channel.copyWith(
              isSubscribed: status['isSubscribed'] == true,
              subscribers: (status['subscriberCount'] as num?)?.toInt() ??
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
            backgroundColor: AppColors.surfaceDark,
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

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.backgroundDark,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.brandOrange),
        ),
      );
    }

    if (_notFound || _channel == null) {
      return Scaffold(
        backgroundColor: AppColors.backgroundDark,
        appBar: AppBar(
          backgroundColor: AppColors.backgroundDark,
          elevation: 0,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.person_off_outlined,
                  size: 48, color: AppColors.textSecondaryDark),
              const SizedBox(height: 16),
              Text(
                'No channel at @${widget.username}',
                style: const TextStyle(color: AppColors.textSecondaryDark),
              ),
            ],
          ),
        ),
      );
    }

    final channel = _channel!;

    if (channel.gated) {
      return Scaffold(
        backgroundColor: AppColors.backgroundDark,
        appBar: AppBar(
          backgroundColor: AppColors.backgroundDark,
          elevation: 0,
          title: Text('@${channel.username}'),
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
                    color: AppColors.textPrimaryDark,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                const Icon(Icons.lock_outline,
                    size: 22, color: AppColors.textSecondaryDark),
                const SizedBox(height: 8),
                const Text(
                  'This account is private.',
                  style: TextStyle(color: AppColors.textSecondaryDark),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: RefreshIndicator(
        color: AppColors.brandOrange,
        backgroundColor: AppColors.surfaceDark,
        onRefresh: _load,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 180,
              pinned: true,
              backgroundColor: AppColors.backgroundDark,
              iconTheme: const IconThemeData(color: AppColors.textPrimaryDark),
              flexibleSpace: FlexibleSpaceBar(
                background: _coverPhoto(channel),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Transform.translate(
                      offset: const Offset(0, -36),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(3),
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.backgroundDark,
                            ),
                            child: _avatar(channel, radius: 40),
                          ),
                          const Spacer(),
                          if (!channel.isOwner) _subscribeButton(channel),
                        ],
                      ),
                    ),
                    Transform.translate(
                      offset: const Offset(0, -24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  channel.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.plusJakartaSans(
                                    color: AppColors.textPrimaryDark,
                                    fontSize: 22,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              if (channel.isVerified) ...[
                                const SizedBox(width: 6),
                                const Icon(Icons.verified,
                                    size: 18, color: AppColors.brandGold),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '@${channel.username}',
                            style: const TextStyle(
                              color: AppColors.textSecondaryDark,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Text(
                                '${_formatCount(channel.subscribers ?? 0)} subscribers',
                                style: const TextStyle(
                                  color: AppColors.textSecondaryDark,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              if (channel.videoCount != null) ...[
                                const SizedBox(width: 10),
                                const Text('•',
                                    style: TextStyle(
                                        color: AppColors.textSecondaryDark)),
                                const SizedBox(width: 10),
                                Text(
                                  '${channel.videoCount} videos',
                                  style: const TextStyle(
                                    color: AppColors.textSecondaryDark,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                              if (channel.totalViews != null) ...[
                                const SizedBox(width: 10),
                                const Text('•',
                                    style: TextStyle(
                                        color: AppColors.textSecondaryDark)),
                                const SizedBox(width: 10),
                                Text(
                                  '${_formatCount(channel.totalViews!)} views',
                                  style: const TextStyle(
                                    color: AppColors.textSecondaryDark,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          if (channel.bio != null &&
                              channel.bio!.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Text(
                              channel.bio!,
                              style: const TextStyle(
                                color: AppColors.textSecondaryDark,
                                fontSize: 13.5,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Text(
                  'Videos',
                  style: GoogleFonts.plusJakartaSans(
                    color: AppColors.textPrimaryDark,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            if (channel.videos.isEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: Text(
                      'No videos yet',
                      style: TextStyle(
                          color: AppColors.textSecondaryDark.withValues(alpha: 0.8)),
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList.separated(
                  itemCount: channel.videos.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 24),
                  itemBuilder: (context, index) {
                    final v = channel.videos[index];
                    return VideoCard(
                      video: v.toVideo(
                        creatorName: channel.name,
                        creatorAvatar: channel.avatarUrl,
                        uploaderUsername: channel.username,
                        uploaderId: channel.creatorId,
                      ),
                    );
                  },
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }

  Widget _coverPhoto(Channel channel) {
    final provider = channel.coverPhotoUrl != null
        ? smartImageProvider(channel.coverPhotoUrl!)
        : null;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.brandOrange.withValues(alpha: 0.35),
            AppColors.backgroundDark,
          ],
        ),
        image: provider != null
            ? DecorationImage(
                image: provider,
                fit: BoxFit.cover,
                colorFilter: ColorFilter.mode(
                  Colors.black.withValues(alpha: 0.25),
                  BlendMode.darken,
                ),
                onError: (_, __) {},
              )
            : null,
      ),
    );
  }

  Widget _avatar(Channel channel, {required double radius}) {
    final provider =
        channel.avatarUrl != null ? smartImageProvider(channel.avatarUrl!) : null;

    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.surfaceDark,
      backgroundImage: provider,
      child: provider == null
          ? Icon(Icons.person, size: radius, color: AppColors.textSecondaryDark)
          : null,
    );
  }

  Widget _subscribeButton(Channel channel) {
    final subscribed = channel.isSubscribed;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (subscribed)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: _toggleNotify,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.surfaceDark,
                  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                ),
                child: Icon(
                  channel.notifyEnabled
                      ? Icons.notifications_active_outlined
                      : Icons.notifications_off_outlined,
                  size: 18,
                  color: channel.notifyEnabled
                      ? AppColors.brandOrange
                      : AppColors.textSecondaryDark,
                ),
              ),
            ),
          ),
        SizedBox(
          height: 36,
          child: ElevatedButton(
            onPressed: _subscribeBusy ? null : _toggleSubscribe,
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  subscribed ? AppColors.surfaceDark : AppColors.brandOrange,
              foregroundColor:
                  subscribed ? AppColors.textPrimaryDark : Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: subscribed
                    ? BorderSide(color: Colors.white.withValues(alpha: 0.08))
                    : BorderSide.none,
              ),
            ),
            child: _subscribeBusy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(Colors.white),
                    ),
                  )
                : Text(
                    subscribed ? 'Subscribed' : 'Subscribe',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  String _formatCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    } else if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return count.toString();
  }
}
