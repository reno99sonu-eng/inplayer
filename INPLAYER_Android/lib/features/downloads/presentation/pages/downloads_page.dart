import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../models/downloaded_item.dart';
import '../../../../services/download_manager.dart';
import 'offline_player_page.dart';

/// The dedicated "Downloads" screen reachable from the hamburger drawer —
/// lists everything actually saved to this device for offline playback,
/// plus anything mid-download right now. Purely local: there's no server
/// round trip here at all, since what matters for "can I watch this
/// offline" is the file on this phone, not any server-side record of it
/// (see DownloadsStore's own doc comment for why).
class DownloadsPage extends ConsumerWidget {
  const DownloadsPage({super.key});

  String _formatBytes(int bytes) {
    if (bytes <= 0) return '0 MB';
    final mb = bytes / (1024 * 1024);
    if (mb < 1024) return '${mb.toStringAsFixed(mb < 10 ? 1 : 0)} MB';
    return '${(mb / 1024).toStringAsFixed(2)} GB';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final manager = ref.watch(downloadManagerProvider);
    final active = manager.active.values.toList();
    final completed = manager.completed;
    final isEmpty = active.isEmpty && completed.isEmpty;

    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          title: Text(
            'Downloads',
            style: TextStyle(fontWeight: FontWeight.w800, color: context.textPrimary, letterSpacing: -0.5),
          ),
        ),
        body: !manager.loaded
            ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
            : isEmpty
                ? _buildEmptyState(context)
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    children: [
                      if (completed.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Row(
                            children: [
                              Icon(Icons.sd_storage_outlined, size: 16, color: context.textSecondary),
                              const SizedBox(width: 6),
                              Text(
                                '${completed.length} downloaded · ${_formatBytes(manager.totalBytes)} used',
                                style: TextStyle(color: context.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      for (final task in active) _buildActiveRow(context, ref, task),
                      for (final item in completed) _buildDownloadedRow(context, ref, item),
                    ],
                  ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return ListView(
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.65,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.download_for_offline_outlined, size: 52, color: context.textDim),
                const SizedBox(height: 16),
                Text(
                  'No downloads yet',
                  style: TextStyle(color: context.textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Text(
                  'Tap Download under any video to save it for offline viewing.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: context.textSecondary, fontSize: 12.5),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActiveRow(BuildContext context, WidgetRef ref, DownloadTask task) {
    final pct = (task.progress * 100).clamp(0, 100);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 36,
            height: 36,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              value: task.progress > 0 ? task.progress : null,
              color: AppColors.brandOrange,
              backgroundColor: context.borderSubtle,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Downloading · ${task.quality}',
                  style: TextStyle(color: context.textPrimary, fontSize: 13, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text(
                  '${pct.toStringAsFixed(0)}%',
                  style: TextStyle(color: context.textSecondary, fontSize: 11.5),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.close, size: 20, color: context.textDim),
            onPressed: () => ref.read(downloadManagerProvider).cancelDownload(task.videoId),
          ),
        ],
      ),
    );
  }

  Widget _buildDownloadedRow(BuildContext context, WidgetRef ref, DownloadedItem item) {
    final provider = item.thumbnailUrl.isNotEmpty ? smartImageProvider(item.thumbnailUrl) : null;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => OfflinePlayerPage(item: item)),
        ),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: context.isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: context.borderSubtle),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  width: 96,
                  height: item.isMusic ? 68 : 54,
                  color: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (provider != null)
                        Image(image: provider, fit: BoxFit.cover)
                      else
                        Icon(
                          item.isMusic ? Icons.music_note : Icons.play_circle_outline,
                          color: context.textDim,
                        ),
                      Positioned(
                        right: 4,
                        bottom: 4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.75),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Icon(Icons.play_arrow_rounded, size: 14, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title.isEmpty ? 'Untitled' : item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w700, height: 1.25),
                    ),
                    const SizedBox(height: 4),
                    if (item.uploaderName.isNotEmpty)
                      Text(
                        item.uploaderName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: context.textSecondary, fontSize: 11.5),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      '${item.qualityLabel} · ${item.fileSizeLabel}',
                      style: TextStyle(color: AppColors.brandOrangeLight, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(Icons.delete_outline, size: 20, color: context.textDim),
                onPressed: () => _confirmDelete(context, ref, item),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context, WidgetRef ref, DownloadedItem item) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove download?'),
        content: Text('"${item.title}" will be deleted from this device.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(downloadManagerProvider).delete(item.videoId);
            },
            child: const Text('Remove', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
