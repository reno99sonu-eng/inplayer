import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/admin_service.dart';
import '../widgets/admin_common.dart';

/// Team-safe cleanup for uploads that the server has independently verified
/// have been stuck in processing for more than two hours. The backend repeats
/// that eligibility check before every deletion.
class AdminStuckProcessingTab extends ConsumerStatefulWidget {
  const AdminStuckProcessingTab({super.key});

  @override
  ConsumerState<AdminStuckProcessingTab> createState() =>
      _AdminStuckProcessingTabState();
}

class _AdminStuckProcessingTabState
    extends ConsumerState<AdminStuckProcessingTab> {
  List<AdminStuckProcessingVideo> _videos = [];
  bool _loading = true;
  bool _loadingInBackground = false;
  String? _error;
  String? _deletingId;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _load(background: true),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool background = false}) async {
    if (_loadingInBackground) return;
    _loadingInBackground = background;
    if (!background && mounted) setState(() => _loading = true);

    final result = await ref
        .read(adminServiceProvider)
        .getStuckProcessingVideos();
    if (!mounted) return;
    setState(() {
      _videos = result.videos;
      _error = result.error;
      _loading = false;
      _loadingInBackground = false;
    });
  }

  Future<void> _delete(AdminStuckProcessingVideo video) async {
    final confirmed = await confirmAdminDialog(
      context,
      title: 'Delete this stuck upload?',
      content:
          '“${video.title}” has been stuck for more than two hours. The server will verify that it is still stuck before deleting it.',
      confirmLabel: 'Delete upload',
    );
    if (!confirmed) return;

    setState(() => _deletingId = video.videoId);
    final success = await ref
        .read(adminServiceProvider)
        .deleteStuckProcessingVideo(video.videoId);
    if (!mounted) return;
    setState(() => _deletingId = null);
    if (success) {
      setState(
        () => _videos = _videos
            .where((item) => item.videoId != video.videoId)
            .toList(),
      );
      showAdminSnack(context, 'Stuck upload deleted.');
    } else {
      showAdminSnack(
        context,
        'Could not delete that upload. It may no longer be stuck; refresh and try again.',
      );
      _load(background: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: context.bgCard,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Stuck Uploads',
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Videos and Shorts that have been processing for over two hours. This list refreshes every 30 seconds.',
            style: TextStyle(
              color: context.textSecondary,
              fontSize: 12,
              height: 1.45,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.error.withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                _error!,
                style: const TextStyle(color: AppColors.error, fontSize: 12),
              ),
            ),
          ],
          const SizedBox(height: 14),
          if (_videos.isEmpty && _error == null)
            Padding(
              padding: const EdgeInsets.only(top: 42),
              child: Column(
                children: [
                  Icon(
                    Icons.verified_rounded,
                    size: 38,
                    color: AppColors.success.withValues(alpha: 0.8),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Nothing stuck right now',
                    style: TextStyle(
                      color: context.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ..._videos.map(_buildVideoCard),
          if (_error != null)
            Center(
              child: TextButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildVideoCard(AdminStuckProcessingVideo video) {
    final deleting = _deletingId == video.videoId;
    final type = video.contentType == 'short' ? 'Raftaar Short' : 'Video';
    final uploaded = video.uploadedAt.isEmpty
        ? 'Upload date unavailable'
        : formatTimeAgo(video.uploadedAt);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Row(
        children: [
          Icon(Icons.hourglass_bottom_rounded, color: AppColors.brandOrange),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  video.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: context.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$type · ${video.uploaderName} · $uploaded · ${video.stuckHours}h stuck',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: context.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Delete stuck upload',
            onPressed: deleting ? null : () => _delete(video),
            icon: deleting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.error,
                    ),
                  )
                : const Icon(Icons.delete_outline, color: AppColors.error),
          ),
        ],
      ),
    );
  }
}
