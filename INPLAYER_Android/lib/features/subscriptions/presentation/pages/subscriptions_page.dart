import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/channel_service.dart';
import '../../../../models/channel.dart';

class SubscriptionsPage extends ConsumerStatefulWidget {
  const SubscriptionsPage({super.key});

  @override
  ConsumerState<SubscriptionsPage> createState() => _SubscriptionsPageState();
}

class _SubscriptionsPageState extends ConsumerState<SubscriptionsPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        title: const Text(
          'In-Family',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
      ),
      body: FutureBuilder<List<Channel>>(
        future: ref.read(channelServiceProvider).getSubscribedChannels(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                  const SizedBox(height: 16),
                  Text(
                    'Failed to load subscriptions',
                    style: TextStyle(color: AppColors.textSecondaryDark),
                  ),
                ],
              ),
            );
          }

          final channels = snapshot.data ?? [];

          if (channels.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.subscriptions_outlined,
                    size: 64,
                    color: AppColors.textSecondaryDark.withValues(alpha: 0.5),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No subscriptions yet',
                    style: TextStyle(
                      color: AppColors.textSecondaryDark,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Subscribe to channels to see their videos here',
                    style: TextStyle(
                      color: AppColors.textSecondaryDark.withValues(alpha: 0.7),
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: channels.length,
            itemBuilder: (context, index) {
              final channel = channels[index];
              return ChannelCard(channel: channel);
            },
          );
        },
      ),
    );
  }
}

class ChannelCard extends StatelessWidget {
  final Channel channel;

  const ChannelCard({super.key, required this.channel});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppColors.cardDark,
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundImage: channel.avatarUrl != null
              ? NetworkImage(channel.avatarUrl!)
              : null,
          child: channel.avatarUrl == null
              ? const Icon(Icons.person)
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
          style: const TextStyle(
            color: AppColors.textSecondaryDark,
          ),
        ),
        trailing: channel.subscribers != null
            ? Text(
                '${_formatSubscribers(channel.subscribers!)} subscribers',
                style: const TextStyle(
                  color: AppColors.textSecondaryDark,
                  fontSize: 12,
                ),
              )
            : null,
      ),
    );
  }

  String _formatSubscribers(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    } else if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return count.toString();
  }
}