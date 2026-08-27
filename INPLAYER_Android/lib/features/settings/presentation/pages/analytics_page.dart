import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/video_service.dart';

/// Real creator analytics computed from GET /api/my-videos — the same raw
/// scan used by the website's own analytics/dashboard surfaces. No fake or
/// estimated numbers: everything here is derived directly from the
/// creator's own uploaded videos/shorts (views, upload count, status).
class AnalyticsPage extends ConsumerStatefulWidget {
  const AnalyticsPage({super.key});

  @override
  ConsumerState<AnalyticsPage> createState() => _AnalyticsPageState();
}

class _AnalyticsPageState extends ConsumerState<AnalyticsPage> {
  late Future<List<Map<String, dynamic>>> _videosFuture;

  @override
  void initState() {
    super.initState();
    _videosFuture = ref.read(videoServiceProvider).getMyVideoStatsRaw();
  }

  int _viewsOf(Map<String, dynamic> v) {
    final raw = v['views'];
    if (raw is num) return raw.toInt();
    return int.tryParse(raw?.toString() ?? '') ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text('Analytics',
            style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark)),
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _videosFuture,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator(color: AppColors.brandOrange));
          }
          final videos = snapshot.data!;
          if (videos.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  "You haven't uploaded anything yet — analytics will show up here once you do.",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textSecondaryDark),
                ),
              ),
            );
          }

          final totalViews = videos.fold<int>(0, (sum, v) => sum + _viewsOf(v));
          final uploads = videos.length;
          final avgViews = uploads == 0 ? 0 : (totalViews / uploads).round();
          final published = videos.where((v) => v['status'] != 'processing').length;

          Map<String, dynamic>? top;
          var topViews = -1;
          for (final v in videos) {
            final views = _viewsOf(v);
            if (views > topViews) {
              topViews = views;
              top = v;
            }
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.5,
                children: [
                  _buildStatCard('Uploads', uploads.toString(), Icons.video_library_outlined),
                  _buildStatCard('Total Views', _formatCount(totalViews), Icons.visibility_outlined),
                  _buildStatCard('Avg. Views', _formatCount(avgViews), Icons.trending_up),
                  _buildStatCard('Published', published.toString(), Icons.check_circle_outline),
                ],
              ),
              if (top != null) ...[
                const SizedBox(height: 20),
                const Text(
                  'Top Performer',
                  style: TextStyle(
                      color: AppColors.textPrimaryDark, fontWeight: FontWeight.w700, fontSize: 15),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.cardDark,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.brandOrange.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.emoji_events_outlined, color: AppColors.brandOrange),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              (top['title'] ?? 'Untitled').toString(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${_formatCount(topViews)} views',
                              style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: AppColors.brandOrange, size: 20),
          Text(value,
              style: const TextStyle(
                  color: AppColors.textPrimaryDark, fontSize: 20, fontWeight: FontWeight.bold)),
          Text(label, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
        ],
      ),
    );
  }

  String _formatCount(int count) {
    if (count >= 1000000) return '${(count / 1000000).toStringAsFixed(1)}M';
    if (count >= 1000) return '${(count / 1000).toStringAsFixed(1)}K';
    return count.toString();
  }
}
