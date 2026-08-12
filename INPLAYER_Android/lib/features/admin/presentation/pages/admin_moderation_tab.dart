import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/moderation_item.dart';

class AdminModerationTab extends StatelessWidget {
  const AdminModerationTab({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          Container(
            color: AppColors.backgroundDark,
            child: const TabBar(
              indicatorColor: AppColors.brandOrange,
              labelColor: AppColors.brandOrange,
              unselectedLabelColor: AppColors.textSecondaryDark,
              tabs: [
                Tab(text: 'Reports'),
                Tab(text: 'Auto-flagged'),
                Tab(text: 'Strikes'),
              ],
            ),
          ),
          const Expanded(
            child: TabBarView(
              children: [
                _ReportsView(),
                _AutoFlaggedView(),
                _StrikesView(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

void _showSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message), backgroundColor: AppColors.surfaceDark),
  );
}

class _ReportsView extends ConsumerStatefulWidget {
  const _ReportsView();

  @override
  ConsumerState<_ReportsView> createState() => _ReportsViewState();
}

class _ReportsViewState extends ConsumerState<_ReportsView> {
  bool _loading = true;
  bool _tableMissing = false;
  List<AdminReport> _reports = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getReports();
    if (!mounted) return;
    setState(() {
      _reports = result.items;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  Future<void> _resolve(AdminReport report, int index) async {
    setState(() => _reports = List.of(_reports)..removeAt(index));
    final ok = await ref.read(adminServiceProvider).resolveReport(report.reportId);
    if (!mounted) return;
    if (!ok) {
      setState(() => _reports = List.of(_reports)..insert(index, report));
      _showSnack(context, "Couldn't resolve that report.");
    }
  }

  IconData _iconFor(String targetType) {
    switch (targetType) {
      case 'comment':
        return Icons.mode_comment_outlined;
      case 'message':
        return Icons.chat_bubble_outline;
      default:
        return Icons.movie_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.brandOrange));
    }
    if (_tableMissing) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            "The reports table hasn't been created in AWS yet, so there's nothing to show here.",
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondaryDark),
          ),
        ),
      );
    }
    if (_reports.isEmpty) {
      return const Center(child: Text('No open reports', style: TextStyle(color: AppColors.textSecondaryDark)));
    }

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView.separated(
        itemCount: _reports.length,
        separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.cardDark),
        itemBuilder: (context, index) {
          final r = _reports[index];
          return ListTile(
            leading: Icon(_iconFor(r.targetType), color: AppColors.brandOrange),
            title: Text(
              r.snippet?.isNotEmpty == true ? r.snippet! : '(no content preview)',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.textPrimaryDark),
            ),
            subtitle: Text(
              'Reason: ${r.reason.replaceAll('_', ' ')} • ${formatTimeAgo(r.createdAt)}',
              style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
            ),
            trailing: TextButton(
              onPressed: () => _resolve(r, index),
              child: const Text('Resolve'),
            ),
          );
        },
      ),
    );
  }
}

class _AutoFlaggedView extends ConsumerStatefulWidget {
  const _AutoFlaggedView();

  @override
  ConsumerState<_AutoFlaggedView> createState() => _AutoFlaggedViewState();
}

class _AutoFlaggedViewState extends ConsumerState<_AutoFlaggedView> {
  bool _loading = true;
  List<AdminFlaggedItem> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final items = await ref.read(adminServiceProvider).getAutoFlagged();
    if (!mounted) return;
    setState(() {
      _items = items;
      _loading = false;
    });
  }

  Future<void> _restore(AdminFlaggedItem item, int index) async {
    final service = ref.read(adminServiceProvider);
    final ok = switch (item.contentType) {
      'comment' => await service.restoreComment(item.videoId!, item.commentId!),
      'message' => await service.restoreMessage(item.conversationId!, item.messageId!),
      _ => await service.restoreVideo(item.videoId!),
    };
    if (!mounted) return;
    if (ok) {
      setState(() => _items = List.of(_items)..removeAt(index));
    } else {
      _showSnack(context, "Couldn't restore that.");
    }
  }

  Future<void> _delete(AdminFlaggedItem item, int index) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Text('Delete permanently?', style: TextStyle(color: AppColors.textPrimaryDark)),
        content: const Text("This can't be undone.", style: TextStyle(color: AppColors.textSecondaryDark)),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final service = ref.read(adminServiceProvider);
    final ok = switch (item.contentType) {
      'comment' => await service.deleteComment(item.videoId!, item.commentId!),
      'message' => await service.deleteMessageContent(item.conversationId!, item.messageId!),
      _ => await service.deleteVideo(item.videoId!),
    };
    if (!mounted) return;
    if (ok) {
      setState(() => _items = List.of(_items)..removeAt(index));
    } else {
      _showSnack(context, "Couldn't delete that.");
    }
  }

  IconData _iconFor(String contentType) {
    switch (contentType) {
      case 'comment':
        return Icons.mode_comment_outlined;
      case 'message':
        return Icons.chat_bubble_outline;
      default:
        return Icons.movie_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.brandOrange));
    }
    if (_items.isEmpty) {
      return const Center(child: Text('Nothing auto-flagged', style: TextStyle(color: AppColors.textSecondaryDark)));
    }

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView.separated(
        itemCount: _items.length,
        separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.cardDark),
        itemBuilder: (context, index) {
          final item = _items[index];
          return ListTile(
            leading: Icon(_iconFor(item.contentType), color: AppColors.error),
            title: Text(
              item.snippet.isNotEmpty ? item.snippet : '(no content preview)',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.textPrimaryDark),
            ),
            subtitle: Text(
              '${item.categories.join(', ')} • ${formatTimeAgo(item.createdAt)}',
              style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.check_circle_outline, color: AppColors.brandOrange, size: 20),
                  tooltip: 'Restore',
                  onPressed: () => _restore(item, index),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: AppColors.error, size: 20),
                  tooltip: 'Delete',
                  onPressed: () => _delete(item, index),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _StrikesView extends ConsumerStatefulWidget {
  const _StrikesView();

  @override
  ConsumerState<_StrikesView> createState() => _StrikesViewState();
}

class _StrikesViewState extends ConsumerState<_StrikesView> {
  bool _loading = true;
  List<AdminStrikeUser> _users = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final users = await ref.read(adminServiceProvider).getStrikes();
    if (!mounted) return;
    setState(() {
      _users = users;
      _loading = false;
    });
  }

  Future<void> _act(AdminStrikeUser user, int index, String action) async {
    final ok = await ref.read(adminServiceProvider).banAction(user.userId, action);
    if (!mounted) return;
    if (ok) {
      setState(() => _users = List.of(_users)..removeAt(index));
    } else {
      _showSnack(context, "Couldn't do that. Try again.");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.brandOrange));
    }
    if (_users.isEmpty) {
      return const Center(
        child: Text('No accounts pending strike review', style: TextStyle(color: AppColors.textSecondaryDark)),
      );
    }

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView.separated(
        itemCount: _users.length,
        separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.cardDark),
        itemBuilder: (context, index) {
          final u = _users[index];
          return ListTile(
            leading: const Icon(Icons.gpp_bad_outlined, color: AppColors.error),
            title: Text(
              u.username != null ? '@${u.username}' : u.userId,
              style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600),
            ),
            subtitle: Text(
              '${u.aiModerationStrikes} strikes${u.banReviewReason != null ? ' • ${u.banReviewReason}' : ''}',
              style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton(
                  onPressed: () => _act(u, index, 'lift_ban'),
                  child: const Text('Lift ban'),
                ),
                TextButton(
                  onPressed: () => _act(u, index, 'uphold_ban'),
                  style: TextButton.styleFrom(foregroundColor: AppColors.error),
                  child: const Text('Uphold'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
