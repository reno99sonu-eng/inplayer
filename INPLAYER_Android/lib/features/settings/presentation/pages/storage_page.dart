import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/video_service.dart';

/// Real counts of what's actually stored under this creator's account,
/// from the same GET /api/my-videos scan Analytics uses. "Storage" here
/// means content counts (Videos/Shorts/Processing) — InPlayer doesn't
/// expose a byte-size quota anywhere in the API, so this deliberately
/// doesn't invent one.
class StoragePage extends ConsumerStatefulWidget {
  const StoragePage({super.key});

  @override
  ConsumerState<StoragePage> createState() => _StoragePageState();
}

class _StoragePageState extends ConsumerState<StoragePage> {
  late Future<List<Map<String, dynamic>>> _videosFuture;

  @override
  void initState() {
    super.initState();
    _videosFuture = ref.read(videoServiceProvider).getMyVideoStatsRaw();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text('Storage',
            style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark)),
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _videosFuture,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator(color: AppColors.brandOrange));
          }
          final items = snapshot.data!;
          final shorts = items.where((v) => v['contentType'] == 'short').length;
          final processing = items.where((v) => v['status'] == 'processing').length;
          final videos = items.length - shorts;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _buildRow('Videos', videos, Icons.videocam_outlined),
              _buildRow('Shorts', shorts, Icons.flash_on_outlined),
              _buildRow('Processing', processing, Icons.hourglass_empty,
                  subtitle: processing > 0 ? "Still being encoded — check back soon" : null),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  '${items.length} item${items.length == 1 ? '' : 's'} total on your channel',
                  style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildRow(String label, int count, IconData icon, {String? subtitle}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.brandOrange.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.brandOrange, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600)),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11)),
                ],
              ],
            ),
          ),
          Text(count.toString(),
              style: const TextStyle(
                  color: AppColors.textPrimaryDark, fontSize: 18, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
