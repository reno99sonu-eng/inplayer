import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/channel_service.dart';
import '../../../../models/channel.dart';

class ChannelPage extends ConsumerStatefulWidget {
  final String username;

  const ChannelPage({super.key, required this.username});

  @override
  ConsumerState<ChannelPage> createState() => _ChannelPageState();
}

class _ChannelPageState extends ConsumerState<ChannelPage> {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Channel?>(
      future: ref.read(channelServiceProvider).getChannel(widget.username),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (snapshot.hasError || snapshot.data == null) {
          return Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                  const SizedBox(height: 16),
                  Text(
                    'Channel not found',
                    style: TextStyle(color: AppColors.textSecondaryDark),
                  ),
                ],
              ),
            ),
          );
        }

        final channel = snapshot.data!;

        return Scaffold(
          backgroundColor: AppColors.backgroundDark,
          body: CustomScrollView(
            slivers: [
              // App Bar
              SliverAppBar(
                expandedHeight: 200,
                pinned: true,
                backgroundColor: AppColors.backgroundDark,
                flexibleSpace: FlexibleSpaceBar(
                  title: Text(channel.name),
                  background: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          AppColors.brandOrange.withValues(alpha: 0.3),
                          AppColors.backgroundDark,
                        ],
                      ),
                    ),
                    child: Center(
                      child: CircleAvatar(
                        radius: 50,
                        backgroundImage: channel.avatarUrl != null
                            ? NetworkImage(channel.avatarUrl!)
                            : null,
                        child: channel.avatarUrl == null
                            ? const Icon(Icons.person, size: 50)
                            : null,
                      ),
                    ),
                  ),
                ),
              ),
              // Channel Info
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  channel.name,
                                  style: const TextStyle(
                                    fontSize: 24,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.textPrimaryDark,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '@${channel.username}',
                                  style: const TextStyle(
                                    color: AppColors.textSecondaryDark,
                                  ),
                                ),
                                if (channel.subscribers != null) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    '${_formatSubscribers(channel.subscribers!)} subscribers',
                                    style: const TextStyle(
                                      color: AppColors.textSecondaryDark,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          ElevatedButton(
                            onPressed: () {
                              // TODO: Handle subscribe/unsubscribe
                            },
                            style: ElevatedButton.styleFrom(
                              minimumSize: const Size(100, 40),
                            ),
                            child: Text(channel.isSubscribed ? 'Subscribed' : 'Subscribe'),
                          ),
                        ],
                      ),
                      if (channel.bio != null && channel.bio!.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Text(
                          channel.bio!,
                          style: const TextStyle(
                            color: AppColors.textSecondaryDark,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              // Videos Section
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'Videos',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimaryDark,
                    ),
                  ),
                ),
              ),
              // Video Grid Placeholder
              SliverFillRemaining(
                child: Center(
                  child: Text(
                    'Channel videos will appear here',
                    style: TextStyle(color: AppColors.textSecondaryDark),
                  ),
                ),
              ),
            ],
          ),
        );
      },
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