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
  /// Which kind this browser opens on: null (all), 'video', 'short' or
  /// 'music'. Mirrors the website's sidebar, where Videos and Shorts are
  /// two separate entries pointing at the same page with a different
  /// `?type=` — the filter chips are still there either way, this just
  /// decides the starting one.
  final String? initialType;

  const AdminContentTab({super.key, this.initialType});

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

  /// null = all kinds. Music is a first-class kind here, not a flavour of
  /// video — the API filters on it separately (TYPE_VALUES in
  /// app/api/admin/videos/route.ts) and the Dashboard's cards link straight
  /// to these filters, so a Music tab whose count didn't match its list
  /// would be worse than no tab.
  String? _type; // null | 'video' | 'short' | 'music'

  /// null = every status. 'ready' additionally matches rows with no status
  /// attribute at all — everything uploaded before that field existed.
  String? _status; // null | 'live' | 'processing' | 'ready' | 'error'

  /// Per-status totals for the active type. Empty means "not counted this
  /// request", never "zero" — the route skips the count scan while a search
  /// query is active.
  Map<String, int> _counts = const {};

  @override
  void initState() {
    super.initState();
    _type = widget.initialType;
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
    final result = await ref.read(adminServiceProvider).getAdminVideos(
          type: _type,
          status: _status,
          query: _query,
          // Only worth asking on an unsearched first page: the route runs a
          // second full-table scan for these and skips it entirely once a
          // query is set, so asking anyway would just return nothing.
          includeCounts: _query.isEmpty,
        );
    if (!mounted) return;
    setState(() {
      _videos = result.videos;
      _nextCursor = result.nextCursor;
      // Keep the previous numbers when this response carried none, rather
      // than blanking the badges mid-search.
      if (result.counts.isNotEmpty) _counts = result.counts;
      _loading = false;
    });
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    final result = await ref.read(adminServiceProvider).getAdminVideos(
          type: _type,
          status: _status,
          query: _query,
          cursor: _nextCursor,
        );
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
    setState(() {
      _type = type;
      // Status counts are computed per type, so the old numbers are stale
      // the instant the type changes — clear rather than show wrong ones.
      _counts = const {};
    });
    _load();
  }

  void _setStatus(String? status) {
    setState(() => _status = status);
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
        // Kind. Music sits alongside Videos and Raftaar as a peer, matching
        // both the API's own three-way split and the website's sidebar.
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _filterChip('All', _type == null, () => _setType(null)),
                const SizedBox(width: 8),
                _filterChip('Videos', _type == 'video', () => _setType('video')),
                const SizedBox(width: 8),
                _filterChip('Raftaar', _type == 'short', () => _setType('short')),
                const SizedBox(width: 8),
                _filterChip('Music', _type == 'music', () => _setType('music')),
              ],
            ),
          ),
        ),
        // Status, with live totals. Deliberately a second row rather than
        // folded into the one above: they are independent filters and the
        // API applies them together, so showing them stacked is the only
        // honest picture of what is currently being listed.
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _statusChip('Any status', null),
                const SizedBox(width: 8),
                _statusChip('Live', 'live'),
                const SizedBox(width: 8),
                _statusChip('Ready', 'ready'),
                const SizedBox(width: 8),
                _statusChip('Processing', 'processing'),
                const SizedBox(width: 8),
                _statusChip('Error', 'error'),
              ],
            ),
          ),
        ),
        Expanded(
          child: _loading
              ? adminLoadingCenter
              : _videos.isEmpty
                  ? AdminEmptyState(
                      message: _type == 'music'
                          ? 'No music tracks found'
                          : _type == 'short'
                              ? 'No Raftaar videos found'
                              : 'No videos found',
                      icon: _type == 'music'
                          ? Icons.library_music_outlined
                          : Icons.movie_outlined,
                    )
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
                                  ? Icon(
                                      v.contentType == 'music'
                                          ? Icons.music_note_rounded
                                          : Icons.movie_outlined,
                                      color: AppColors.textSecondaryDark,
                                      size: 18,
                                    )
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
                                    '${_kindLabel(v.contentType)} • ${v.views} views'
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

  /// Row label for a content kind. 'Raftaar' rather than 'Short' because
  /// that is what this platform calls them everywhere a person can see —
  /// the wire value stays 'short'.
  String _kindLabel(String contentType) => switch (contentType) {
        'short' => 'Raftaar',
        'music' => 'Music',
        _ => 'Video',
      };

  /// A status chip, badged with its real total when the route supplied
  /// counts. No number is shown rather than a zero when it didn't — "0
  /// processing" and "we didn't count" are very different facts to an admin
  /// deciding whether something is stuck.
  Widget _statusChip(String label, String? status) {
    final count = status == null ? null : _counts[status];
    final text = count == null ? label : '$label ($count)';
    return _filterChip(text, _status == status, () => _setStatus(status));
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
