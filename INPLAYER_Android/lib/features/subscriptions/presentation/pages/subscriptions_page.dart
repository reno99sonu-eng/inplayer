import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../services/channel_service.dart';
import '../../../../models/channel.dart';

class SubscriptionsPage extends ConsumerStatefulWidget {
  const SubscriptionsPage({super.key});

  @override
  ConsumerState<SubscriptionsPage> createState() => _SubscriptionsPageState();
}

class _SubscriptionsPageState extends ConsumerState<SubscriptionsPage> {
  bool _loading = true;
  List<Channel> _channels = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final channels = await ref.read(channelServiceProvider).getSubscribedChannels();
    if (!mounted) return;
    setState(() {
      _channels = channels;
      _loading = false;
    });
  }

  Future<void> _toggleNotify(int index) async {
    final channel = _channels[index];
    final next = !channel.notifyEnabled;
    setState(() {
      _channels = List.of(_channels)..[index] = channel.copyWith(notifyEnabled: next);
    });

    final ok =
        await ref.read(channelServiceProvider).setNotifyEnabled(channel.creatorId, next);
    if (!ok && mounted) {
      setState(() {
        _channels = List.of(_channels)..[index] = channel;
      });
    }
  }

  Future<void> _unsubscribe(int index) async {
    final channel = _channels[index];
    setState(() => _channels = List.of(_channels)..removeAt(index));

    final ok = await ref.read(channelServiceProvider).unsubscribeFromChannel(channel.creatorId);
    if (!ok && mounted) {
      setState(() => _channels = List.of(_channels)..insert(index, channel));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Couldn't unsubscribe. Try again."),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
    }
  }

  void _showOptions(int index) {
    final channel = _channels[index];
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.cardDark,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.person_outline, color: AppColors.textPrimaryDark),
              title: const Text('View channel', style: TextStyle(color: AppColors.textPrimaryDark)),
              onTap: () {
                Navigator.of(context).pop();
                context.push('/channel/${channel.username}');
              },
            ),
            ListTile(
              leading: const Icon(Icons.notifications_off_outlined, color: AppColors.error),
              title: const Text('Unsubscribe', style: TextStyle(color: AppColors.error)),
              onTap: () {
                Navigator.of(context).pop();
                _unsubscribe(index);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text(
          'In-Family',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
          : RefreshIndicator(
              color: AppColors.brandOrange,
              backgroundColor: AppColors.surfaceDark,
              onRefresh: _load,
              child: _channels.isEmpty
                  ? ListView(
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.65,
                          child: Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.subscriptions_outlined,
                                  size: 56,
                                  color: AppColors.textSecondaryDark.withValues(alpha: 0.5),
                                ),
                                const SizedBox(height: 16),
                                const Text(
                                  'No subscriptions yet',
                                  style: TextStyle(
                                    color: AppColors.textSecondaryDark,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Subscribe to channels to see them here',
                                  style: TextStyle(
                                    color: AppColors.textSecondaryDark.withValues(alpha: 0.7),
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: _channels.length,
                      separatorBuilder: (context, index) =>
                          const Divider(height: 1, color: AppColors.cardDark),
                      itemBuilder: (context, index) {
                        final channel = _channels[index];
                        final avatar =
                            channel.avatarUrl != null ? smartImageProvider(channel.avatarUrl!) : null;

                        return ListTile(
                          onTap: () => context.push('/channel/${channel.username}'),
                          onLongPress: () => _showOptions(index),
                          leading: CircleAvatar(
                            backgroundColor: AppColors.surfaceDark,
                            backgroundImage: avatar,
                            child: avatar == null
                                ? const Icon(Icons.person, color: AppColors.textSecondaryDark)
                                : null,
                          ),
                          title: Text(
                            channel.name,
                            style: const TextStyle(
                              color: AppColors.textPrimaryDark,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          subtitle: Text(
                            '@${channel.username}',
                            style: const TextStyle(color: AppColors.textSecondaryDark),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: Icon(
                                  channel.notifyEnabled
                                      ? Icons.notifications_active_outlined
                                      : Icons.notifications_off_outlined,
                                  color: channel.notifyEnabled
                                      ? AppColors.brandOrange
                                      : AppColors.textSecondaryDark,
                                  size: 20,
                                ),
                                onPressed: () => _toggleNotify(index),
                              ),
                              IconButton(
                                icon: const Icon(Icons.more_vert,
                                    color: AppColors.textSecondaryDark, size: 20),
                                onPressed: () => _showOptions(index),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
