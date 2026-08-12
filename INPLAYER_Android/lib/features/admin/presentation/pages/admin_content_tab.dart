import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/admin_video_row.dart';
import '../widgets/admin_common.dart';

/// Admin content browser (GET /api/admin/videos) — deliberately shows
/// every status/visibility, unlike the public site or the Moderation tab's
/// auto-flagged queue. This is "find any video/short by title or id and
/// act on it," not a moderation inbox.
class AdminContentTab extends ConsumerStatefulWidget {
  const AdminContentTab({super.key});

  @override
  ConsumerState<AdminContentTab> createState() => _AdminContentTabState();
}

class _AdminContentTabState extends ConsumerState<AdminContentTab> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  bool _loading = true;
  bool _loadingMore = false;
  List<AdminVideoRow> _videos = [];
  String? _nextCursor;
  String _query = '';
  String? _type; // null = all, 'video', 'short'

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getAdminVideos(type: _type, query: _query);
    if (!mounted) return;
    setState(() {
      _videos = result.videos;
      _nextCursor = result.nextCursor;
      _loading = false;
    });
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    final result = await ref.read(adminServiceProvider).getAdminVideos(type: _type, query: _query, cursor: _nextCursor);
    if (!mounted) return;
    setState(() {
      _videos = [..._videos, ...result.videos];
      _nextCursor = result.nextCursor;
      _loadingMore = false;
    });
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      _query = value.trim();
      _load();
    });
  }

  void _setType(String? type) {
    setState(() => _type = type);
    _load();
  }

  Future<void> _restore(AdminVideoRow v, int index) async {
    final ok = await ref.read(adminServiceProvider).restoreVideo(v.videoId);
    if (!mounted) return;
    if (ok) {
      _load();
    } else {
      showAdminSnack(context, "Couldn't restore that.");
    }
  }

  Future<void> _delete(AdminVideoRow v, int index) async {
    final confirmed = await confirmAdminDialog(
      context,
      title: 'Delete permanently?',
      content: '"${v.title}" and all its data will be permanently deleted. This can\'t be undone.',
      confirmLabel: 'Delete',
    );
    if (!confirmed) return;
    final ok = await ref.read(adminServiceProvider).deleteVideo(v.videoId);
    if (!mounted) return;
    if (ok) {
      setState(() => _videos = List.of(_videos)..removeAt(index));
    } else {
      showAdminSnack(context, "Couldn't delete that.");
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'ready':
        return AppColors.success;
      case 'processing':
        return AppColors.brandOrange;
      case 'error':
        return AppColors.error;
      case 'removed':
      case 'deleted':
        return AppColors.error;
      default:
        return AppColors.textSecondaryDark;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: Container(
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search by title or videoId...',
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 14),
                prefixIcon: Icon(Icons.search, color: Colors.white.withValues(alpha: 0.4), size: 20),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              _filterChip('All', _type == null, () => _setType(null)),
              const SizedBox(width: 8),
              _filterChip('Videos', _type == 'video', () => _setType('video')),
              const SizedBox(width: 8),
              _filterChip('Shorts', _type == 'short', () => _setType('short')),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? adminLoadingCenter
              : _videos.isEmpty
                  ? const AdminEmptyState(message: 'No videos found', icon: Icons.movie_outlined)
                  : NotificationListener<ScrollNotification>(
                      onNotification: (notification) {
                        if (notification.metrics.pixels > notification.metrics.maxScrollExtent - 200) {
                          _loadMore();
                        }
                        return false;
                      },
                      child: ListView.separated(
                        itemCount: _videos.length + (_nextCursor != null ? 1 : 0),
                        separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.cardDark),
                        itemBuilder: (context, index) {
                          if (index >= _videos.length) {
                            return const Padding(
                              padding: EdgeInsets.all(16),
                              child: Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
                            );
                          }
                          final v = _videos[index];
                          final thumb = v.thumbnailUrl != null && v.thumbnailUrl!.isNotEmpty
                              ? smartImageProvider(v.thumbnailUrl!)
                              : null;

                          return ListTile(
                            leading: Container(
                              width: 56,
                              height: 40,
                              decoration: BoxDecoration(
                                color: AppColors.surfaceDark,
                                borderRadius: BorderRadius.circular(6),
                                image: thumb != null ? DecorationImage(image: thumb, fit: BoxFit.cover) : null,
                              ),
                              child: thumb == null
                                  ? const Icon(Icons.movie_outlined, color: AppColors.textSecondaryDark, size: 18)
                                  : null,
                            ),
                            title: Text(
                              v.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  AdminStatusPill(label: v.status, color: _statusColor(v.status)),
                                  Text(
                                    '${v.contentType == 'short' ? 'Short' : 'Video'} • ${v.views} views'
                                    '${v.uploaderName != null ? ' • @${v.uploaderName}' : ''} • ${formatTimeAgo(v.uploadedAt)}',
                                    style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                            trailing: PopupMenuButton<String>(
                              icon: const Icon(Icons.more_vert, color: AppColors.textPrimaryDark),
                              color: AppColors.cardDark,
                              onSelected: (action) {
                                if (action == 'restore') {
                                  _restore(v, index);
                                } else if (action == 'delete') {
                                  _delete(v, index);
                                }
                              },
                              itemBuilder: (context) => [
                                const PopupMenuItem(
                                  value: 'restore',
                                  child: Text('Restore', style: TextStyle(color: AppColors.textPrimaryDark)),
                                ),
                                const PopupMenuItem(
                                  value: 'delete',
                                  child: Text('Delete permanently', style: TextStyle(color: AppColors.error)),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _filterChip(String label, bool selected, VoidCallback onTap) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      backgroundColor: AppColors.cardDark,
      selectedColor: AppColors.brandOrange.withValues(alpha: 0.25),
      labelStyle: TextStyle(color: selected ? AppColors.brandOrange : AppColors.textSecondaryDark, fontSize: 12),
      side: BorderSide.none,
    );
  }
}
