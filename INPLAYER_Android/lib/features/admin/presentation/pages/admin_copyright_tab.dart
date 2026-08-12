import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/admin_copyright_report.dart';
import '../widgets/admin_common.dart';

/// Copyright strikes queue (GET/POST /api/admin/copyright) — mirrors
/// app/api/admin/copyright/route.ts. Striking an uploader auto-suspends
/// them once they cross `strikeThreshold` (3 on the backend today).
class AdminCopyrightTab extends ConsumerStatefulWidget {
  const AdminCopyrightTab({super.key});

  @override
  ConsumerState<AdminCopyrightTab> createState() => _AdminCopyrightTabState();
}

class _AdminCopyrightTabState extends ConsumerState<AdminCopyrightTab> {
  bool _loading = true;
  AdminCopyrightResult? _result;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getCopyrightReports();
    if (!mounted) return;
    setState(() {
      _result = result;
      _loading = false;
    });
  }

  Future<void> _dismiss(AdminCopyrightReport r, int index) async {
    final result = await ref.read(adminServiceProvider).copyrightAction(r.reportId, 'dismiss');
    if (!mounted) return;
    if (result.success) {
      setState(() => _result = AdminCopyrightResult(
            items: List.of(_result!.items)..removeAt(index),
            strikeThreshold: _result!.strikeThreshold,
          ));
    } else {
      showAdminSnack(context, result.error ?? "Couldn't dismiss that.");
    }
  }

  Future<void> _strike(AdminCopyrightReport r, int index) async {
    bool removeVideo = false;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: const Text('Strike uploader?', style: TextStyle(color: AppColors.textPrimaryDark)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '@${r.uploaderUsername ?? r.uploaderId ?? 'unknown'} is at ${r.currentStrikes}/${_result!.strikeThreshold} strikes.',
                style: const TextStyle(color: AppColors.textSecondaryDark),
              ),
              const SizedBox(height: 12),
              CheckboxListTile(
                value: removeVideo,
                onChanged: (v) => setDialogState(() => removeVideo = v ?? false),
                title: const Text('Also remove the video', style: TextStyle(color: AppColors.textPrimaryDark, fontSize: 13)),
                controlAffinity: ListTileControlAffinity.leading,
                activeColor: AppColors.brandOrange,
                contentPadding: EdgeInsets.zero,
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: TextButton.styleFrom(foregroundColor: AppColors.error),
              child: const Text('Strike'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;

    final result = await ref.read(adminServiceProvider).copyrightAction(r.reportId, 'strike', removeVideo: removeVideo);
    if (!mounted) return;
    if (result.success) {
      setState(() => _result = AdminCopyrightResult(
            items: List.of(_result!.items)..removeAt(index),
            strikeThreshold: _result!.strikeThreshold,
          ));
      showAdminSnack(context, 'Strike applied.');
    } else {
      showAdminSnack(context, result.error ?? "Couldn't apply that strike.");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    final result = _result;
    if (result == null || result.tableMissing) {
      return const AdminTableMissingNotice(message: "The reports table hasn't been created in AWS yet.");
    }
    if (result.items.isEmpty) {
      return const AdminEmptyState(message: 'No open copyright reports', icon: Icons.copyright_outlined);
    }

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: result.items.length,
        separatorBuilder: (context, index) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final r = result.items[index];
          return Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(14)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(r.title, style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(
                  'Uploader: @${r.uploaderUsername ?? r.uploaderId ?? 'unknown'} • ${r.currentStrikes}/${result.strikeThreshold} strikes',
                  style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
                ),
                if (r.details != null && r.details!.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(r.details!, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
                ],
                const SizedBox(height: 4),
                Text(formatTimeAgo(r.createdAt), style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11)),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(onPressed: () => _dismiss(r, index), child: const Text('Dismiss')),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () => _strike(r, index),
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                      child: const Text('Strike'),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
