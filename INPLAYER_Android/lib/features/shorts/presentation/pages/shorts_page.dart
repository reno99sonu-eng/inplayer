import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/video_service.dart';
import '../../../../models/short.dart';
import '../widgets/short_player_widget.dart';

class ShortsPage extends ConsumerStatefulWidget {
  const ShortsPage({super.key});

  @override
  ConsumerState<ShortsPage> createState() => _ShortsPageState();
}

class _ShortsPageState extends ConsumerState<ShortsPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text(
          'Raftaar',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
            fontSize: 22,
          ),
        ),
      ),
      body: FutureBuilder<List<Short>>(
        future: ref.read(videoServiceProvider).getShorts(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange),
            );
          }

          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.error_outline,
                    size: 48,
                    color: AppColors.error,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Failed to load shorts',
                    style: TextStyle(color: AppColors.textSecondaryDark),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () => setState(() {}),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          final shorts = snapshot.data ?? [];

          if (shorts.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.play_circle_outline,
                    size: 64,
                    color: AppColors.textSecondaryDark.withOpacity(0.5),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No shorts available',
                    style: TextStyle(
                      color: AppColors.textSecondaryDark,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Check back later for new content',
                    style: TextStyle(
                      color: AppColors.textSecondaryDark.withOpacity(0.7),
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            );
          }

          return PageView.builder(
            scrollDirection: Axis.vertical,
            itemCount: shorts.length,
            itemBuilder: (context, index) {
              final short = shorts[index];
              return ShortPlayerWidget(short: short);
            },
          );
        },
      ),
    );
  }
}
