import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../models/film_creator_application.dart';
import '../../../../services/admin_service.dart';
import '../widgets/admin_common.dart';

/// Raftaar Films Creator Applications review queue (GET/POST /api/admin/raftaar-films/applications)
/// Editorial review of creator applications with 48-72h SLA.
class AdminRaftaarFilmsTab extends StatelessWidget {
  const AdminRaftaarFilmsTab({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          Container(
            color: context.bgCanvas,
            child: TabBar(
              indicatorColor: AppColors.brandOrange,
              labelColor: AppColors.brandOrange,
              unselectedLabelColor: context.textSecondary,
              tabs: const [
                Tab(text: 'Pending'),
                Tab(text: 'Approved'),
                Tab(text: 'Rejected'),
              ],
            ),
          ),
          const Expanded(
            child: TabBarView(
              children: [
                _ApplicationsView(status: 'pending'),
                _ApplicationsView(status: 'approved'),
                _ApplicationsView(status: 'rejected'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ApplicationsView extends ConsumerStatefulWidget {
  final String status;
  const _ApplicationsView({required this.status});

  @override
  ConsumerState<_ApplicationsView> createState() => _ApplicationsViewState();
}

class _ApplicationsViewState extends ConsumerState<_ApplicationsView> {
  bool _loading = true;
  List<FilmCreatorApplication> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final list = await ref
        .read(adminServiceProvider)
        .getRaftaarFilmsApplications(status: widget.status);
    if (!mounted) {
      return;
    }
    setState(() {
      _items = list;
      _loading = false;
    });
  }

  Future<void> _approve(FilmCreatorApplication app, int index) async {
    final result = await ref
        .read(adminServiceProvider)
        .raftaarFilmsApplicationAction(app.applicationId, 'approve');
    if (!mounted) {
      return;
    }
    if (result.success) {
      setState(() => _items = List.of(_items)..removeAt(index));
      showAdminSnack(context, 'Approved ${app.channelName}.');
    } else {
      showAdminSnack(context, result.error ?? "Couldn't approve application.");
    }
  }

  Future<void> _reject(FilmCreatorApplication app, int index) async {
    final reasonController = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Text(
          'Reject Application',
          style: TextStyle(color: AppColors.textPrimaryDark),
        ),
        content: TextField(
          controller: reasonController,
          maxLines: 3,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: const InputDecoration(
            hintText: 'Reason (shown to creator, e.g. need vertical samples)',
            hintStyle: TextStyle(color: AppColors.textSecondaryDark),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () =>
                Navigator.of(context).pop(reasonController.text.trim()),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) {
      return;
    }

    final result = await ref
        .read(adminServiceProvider)
        .raftaarFilmsApplicationAction(app.applicationId, 'reject',
            reason: reason);
    if (!mounted) {
      return;
    }
    if (result.success) {
      setState(() => _items = List.of(_items)..removeAt(index));
      showAdminSnack(context, 'Rejected application.');
    } else {
      showAdminSnack(context, result.error ?? "Couldn't reject application.");
    }
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondaryDark,
                fontSize: 12,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: AppColors.textPrimaryDark,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return adminLoadingCenter;
    }
    if (_items.isEmpty) {
      return AdminEmptyState(
        message: 'No ${widget.status} applications',
        icon: Icons.movie_filter_outlined,
      );
    }

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _items.length,
        separatorBuilder: (context, index) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final app = _items[index];
          final isPending = app.isPending;

          return Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.cardDark,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.08),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        app.channelName,
                        style: const TextStyle(
                          color: AppColors.textPrimaryDark,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: app.isApproved
                            ? Colors.green.withValues(alpha: 0.15)
                            : app.isRejected
                                ? Colors.red.withValues(alpha: 0.15)
                                : AppColors.brandOrange.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        app.status.toUpperCase(),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: app.isApproved
                              ? Colors.green
                              : app.isRejected
                                  ? Colors.red
                                  : AppColors.brandOrange,
                        ),
                      ),
                    ),
                  ],
                ),
                Text(
                  '@${app.username}',
                  style: const TextStyle(
                    color: AppColors.textSecondaryDark,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 10),
                _infoRow('Legal Name', app.personalName),
                if (app.companyName != null && app.companyName!.isNotEmpty)
                  _infoRow('Company', app.companyName!),
                if (app.email != null && app.email!.isNotEmpty)
                  _infoRow('Email', app.email!),
                if (app.phoneNumber != null && app.phoneNumber!.isNotEmpty)
                  _infoRow('Phone', app.phoneNumber!),
                if (app.submittedAt.isNotEmpty)
                  _infoRow('Submitted', formatTimeAgo(app.submittedAt)),
                if (app.rejectionReason != null &&
                    app.rejectionReason!.isNotEmpty)
                  _infoRow('Rejection', app.rejectionReason!),
                if (isPending) ...[
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => _reject(app, index),
                        icon: const Icon(Icons.close, size: 16),
                        label: const Text('Reject'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.redAccent,
                          side: const BorderSide(color: Colors.redAccent),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton.icon(
                        onPressed: () => _approve(app, index),
                        icon: const Icon(Icons.check, size: 16),
                        label: const Text('Approve'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green,
                          foregroundColor: Colors.white,
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
