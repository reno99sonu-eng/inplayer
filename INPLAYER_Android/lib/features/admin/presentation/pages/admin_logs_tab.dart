import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/admin_audit_log.dart';
import '../../../../models/admin_error_log.dart';
import '../../../../models/admin_bug_report.dart';
import '../widgets/admin_common.dart';

/// Diagnostics — Audit Logs (every admin action, GET /api/admin/audit-logs),
/// Error Logs (automatic crash telemetry, GET/DELETE /api/admin/error-logs)
/// and Bug Reports (user-submitted "something's wrong," GET/POST
/// /api/admin/bug-reports) grouped into one section since all three are
/// "what went wrong / who did what."
class AdminLogsTab extends StatelessWidget {
  const AdminLogsTab({super.key});

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
              tabs: const [Tab(text: 'Audit'), Tab(text: 'Errors'), Tab(text: 'Bug reports')],
            ),
          ),
          const Expanded(
            child: TabBarView(children: [_AuditLogsView(), _ErrorLogsView(), _BugReportsView()]),
          ),
        ],
      ),
    );
  }
}

class _AuditLogsView extends ConsumerStatefulWidget {
  const _AuditLogsView();

  @override
  ConsumerState<_AuditLogsView> createState() => _AuditLogsViewState();
}

class _AuditLogsViewState extends ConsumerState<_AuditLogsView> {
  bool _loading = true;
  AdminAuditLogResult? _result;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getAuditLogs();
    if (!mounted) return;
    setState(() {
      _result = result;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    final result = _result;
    if (result == null || result.tableMissing) {
      return const AdminTableMissingNotice(message: "The audit log table hasn't been created in AWS yet.");
    }
    if (result.items.isEmpty) {
      return const AdminEmptyState(message: 'No admin actions logged yet', icon: Icons.history);
    }

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView.separated(
        itemCount: result.items.length,
        separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.cardDark),
        itemBuilder: (context, index) {
          final log = result.items[index];
          final mismatched = (log.location != null && result.viewerLocation != null && log.location != result.viewerLocation) ||
              (log.device != null && result.viewerDevice != null && log.device != result.viewerDevice);
          return ListTile(
            leading: Icon(
              mismatched ? Icons.warning_amber_rounded : Icons.check_circle_outline,
              color: mismatched ? AppColors.error : AppColors.textSecondaryDark,
              size: 20,
            ),
            title: Text(
              '${log.action} • ${log.targetType}${log.targetLabel != null ? ' (${log.targetLabel})' : ''}',
              style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 13),
            ),
            subtitle: Text(
              '${log.adminEmail} • ${formatTimeAgo(log.createdAt)}'
              '${log.location != null ? ' • ${log.location}' : ''}${log.device != null ? ' • ${log.device}' : ''}'
              '${log.details != null ? '\n${log.details}' : ''}',
              style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11),
            ),
            isThreeLine: log.details != null,
          );
        },
      ),
    );
  }
}

class _ErrorLogsView extends ConsumerStatefulWidget {
  const _ErrorLogsView();

  @override
  ConsumerState<_ErrorLogsView> createState() => _ErrorLogsViewState();
}

class _ErrorLogsViewState extends ConsumerState<_ErrorLogsView> {
  bool _loading = true;
  bool _tableMissing = false;
  List<AdminErrorLog> _logs = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getErrorLogs();
    if (!mounted) return;
    setState(() {
      _logs = result.logs;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  Future<void> _delete(AdminErrorLog log, int index) async {
    final ok = await ref.read(adminServiceProvider).deleteErrorLog(log.errorId);
    if (!mounted) return;
    if (ok) {
      setState(() => _logs = List.of(_logs)..removeAt(index));
    } else {
      showAdminSnack(context, "Couldn't delete that.");
    }
  }

  Future<void> _clearAll() async {
    final confirmed = await confirmAdminDialog(context, title: 'Clear all error logs?', content: 'This deletes every logged error. This can\'t be undone.', confirmLabel: 'Clear all');
    if (!confirmed) return;
    final ok = await ref.read(adminServiceProvider).clearErrorLogs();
    if (!mounted) return;
    if (ok) {
      setState(() => _logs = []);
    } else {
      showAdminSnack(context, "Couldn't clear those.");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    if (_tableMissing) {
      return const AdminTableMissingNotice(message: "The error logs table hasn't been created in AWS yet.");
    }
    if (_logs.isEmpty) {
      return const AdminEmptyState(message: 'No errors logged', icon: Icons.bug_report_outlined);
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: _clearAll,
              style: TextButton.styleFrom(foregroundColor: AppColors.error),
              child: const Text('Clear all'),
            ),
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.brandOrange,
            backgroundColor: AppColors.surfaceDark,
            onRefresh: _load,
            child: ListView.separated(
              itemCount: _logs.length,
              separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.cardDark),
              itemBuilder: (context, index) {
                final log = _logs[index];
                return ListTile(
                  leading: const Icon(Icons.error_outline, color: AppColors.error, size: 20),
                  title: Text(log.message, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 13)),
                  subtitle: Text(
                    '${log.kind} • ${log.pathname} • ${formatTimeAgo(log.createdAt)}',
                    style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline, color: AppColors.textSecondaryDark, size: 18),
                    onPressed: () => _delete(log, index),
                  ),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _BugReportsView extends ConsumerStatefulWidget {
  const _BugReportsView();

  @override
  ConsumerState<_BugReportsView> createState() => _BugReportsViewState();
}

class _BugReportsViewState extends ConsumerState<_BugReportsView> {
  bool _loading = true;
  bool _tableMissing = false;
  List<AdminBugReport> _reports = [];
  String? _statusFilter;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getBugReports(status: _statusFilter);
    if (!mounted) return;
    setState(() {
      _reports = result.reports;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  void _setFilter(String? status) {
    setState(() => _statusFilter = status);
    _load();
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'resolved':
        return AppColors.success;
      case 'in_progress':
        return AppColors.brandOrange;
      default:
        return AppColors.textSecondaryDark;
    }
  }

  Future<void> _openDetail(AdminBugReport report, int index) async {
    final notesController = TextEditingController(text: report.adminNotes ?? '');
    String status = report.status;
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: const Text('Bug report', style: TextStyle(color: AppColors.textPrimaryDark)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(report.description, style: const TextStyle(color: AppColors.textSecondaryDark)),
                const SizedBox(height: 8),
                Text('Page: ${report.pageUrl}', style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11)),
                if (report.reporterEmail.isNotEmpty)
                  Text('Reporter: ${report.reporterUsername != null ? '@${report.reporterUsername}' : report.reporterEmail}',
                      style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11)),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  children: ['open', 'in_progress', 'resolved']
                      .map((s) => ChoiceChip(
                            label: Text(s.replaceAll('_', ' ')),
                            selected: status == s,
                            onSelected: (_) => setDialogState(() => status = s),
                            backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                            selectedColor: AppColors.brandOrange.withValues(alpha: 0.25),
                            labelStyle: TextStyle(color: status == s ? AppColors.brandOrange : context.textSecondary, fontSize: 11),
                            side: BorderSide.none,
                          ))
                      .toList(),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesController,
                  maxLines: 3,
                  style: const TextStyle(color: AppColors.textPrimaryDark),
                  decoration: const InputDecoration(hintText: 'Admin notes', hintStyle: TextStyle(color: AppColors.textSecondaryDark)),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: TextButton.styleFrom(foregroundColor: AppColors.brandOrange),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (result != true) return;
    final ok = await ref.read(adminServiceProvider).updateBugReportStatus(report.reportId, status, adminNotes: notesController.text.trim());
    if (!mounted) return;
    if (ok) {
      _load();
    } else {
      showAdminSnack(context, "Couldn't save that.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              _chip('All', null),
              const SizedBox(width: 6),
              _chip('Open', 'open'),
              const SizedBox(width: 6),
              _chip('In progress', 'in_progress'),
              const SizedBox(width: 6),
              _chip('Resolved', 'resolved'),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? adminLoadingCenter
              : _tableMissing
                  ? const AdminTableMissingNotice(message: "The bug reports table hasn't been created in AWS yet.")
                  : _reports.isEmpty
                      ? const AdminEmptyState(message: 'No bug reports', icon: Icons.bug_report_outlined)
                      : RefreshIndicator(
                          color: AppColors.brandOrange,
                          backgroundColor: AppColors.surfaceDark,
                          onRefresh: _load,
                          child: ListView.separated(
                            itemCount: _reports.length,
                            separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.cardDark),
                            itemBuilder: (context, index) {
                              final r = _reports[index];
                              return ListTile(
                                onTap: () => _openDetail(r, index),
                                title: Text(r.description, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 13)),
                                subtitle: Text(
                                  '${r.reporterUsername != null ? '@${r.reporterUsername}' : r.reporterEmail} • ${formatTimeAgo(r.createdAt)}',
                                  style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11),
                                ),
                                trailing: AdminStatusPill(label: r.status.replaceAll('_', ' '), color: _statusColor(r.status)),
                              );
                            },
                          ),
                        ),
        ),
      ],
    );
  }

  Widget _chip(String label, String? value) {
    final selected = _statusFilter == value;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => _setFilter(value),
      backgroundColor: AppColors.cardDark,
      selectedColor: AppColors.brandOrange.withValues(alpha: 0.25),
      labelStyle: TextStyle(color: selected ? AppColors.brandOrange : AppColors.textSecondaryDark, fontSize: 12),
      side: BorderSide.none,
    );
  }
}
