import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/admin_creator_kyc.dart';
import '../widgets/admin_common.dart';

/// Creator payout-KYC review queue (GET/POST /api/admin/creators) — a real
/// person reviews each submission's bank/PAN/ID details before a creator
/// can receive payouts. Mirrors app/api/admin/creators/route.ts.
class AdminCreatorsTab extends StatelessWidget {
  const AdminCreatorsTab({super.key});

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
              tabs: [Tab(text: 'Pending'), Tab(text: 'Verified'), Tab(text: 'Rejected')],
            ),
          ),
          const Expanded(
            child: TabBarView(children: [
              _CreatorKycView(tab: 'pending_review'),
              _CreatorKycView(tab: 'verified'),
              _CreatorKycView(tab: 'rejected'),
            ]),
          ),
        ],
      ),
    );
  }
}

class _CreatorKycView extends ConsumerStatefulWidget {
  final String tab;
  const _CreatorKycView({required this.tab});

  @override
  ConsumerState<_CreatorKycView> createState() => _CreatorKycViewState();
}

class _CreatorKycViewState extends ConsumerState<_CreatorKycView> {
  bool _loading = true;
  bool _tableMissing = false;
  List<AdminCreatorKyc> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getCreatorsKyc(tab: widget.tab);
    if (!mounted) return;
    setState(() {
      _items = result.items;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  Future<void> _approve(AdminCreatorKyc c, int index) async {
    final result = await ref.read(adminServiceProvider).creatorKycAction(c.userId, 'approve');
    if (!mounted) return;
    if (result.success) {
      setState(() => _items = List.of(_items)..removeAt(index));
      showAdminSnack(context, 'Approved.');
    } else {
      showAdminSnack(context, result.error ?? "Couldn't approve that.");
    }
  }

  Future<void> _reject(AdminCreatorKyc c, int index) async {
    final reasonController = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Text('Reject submission', style: TextStyle(color: AppColors.textPrimaryDark)),
        content: TextField(
          controller: reasonController,
          maxLines: 3,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: const InputDecoration(hintText: 'Reason (shown to the creator)', hintStyle: TextStyle(color: AppColors.textSecondaryDark)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(reasonController.text.trim()),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) return;

    final result = await ref.read(adminServiceProvider).creatorKycAction(c.userId, 'reject', reason: reason);
    if (!mounted) return;
    if (result.success) {
      setState(() => _items = List.of(_items)..removeAt(index));
      showAdminSnack(context, 'Rejected.');
    } else {
      showAdminSnack(context, result.error ?? "Couldn't reject that.");
    }
  }

  void _viewDocument(String label, String dataUrl) {
    final provider = smartImageProvider(dataUrl);
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: AppColors.cardDark,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label, style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              if (provider != null) Image(image: provider, fit: BoxFit.contain) else const Text('Could not load image'),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    if (_tableMissing) {
      return const AdminTableMissingNotice(message: "Creator payout tables haven't been created in AWS yet.");
    }
    if (_items.isEmpty) {
      return const AdminEmptyState(message: 'Nothing here', icon: Icons.badge_outlined);
    }

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _items.length,
        separatorBuilder: (context, index) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final c = _items[index];
          return Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(14)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  c.legalName?.isNotEmpty == true ? c.legalName! : (c.username != null ? '@${c.username}' : c.userId),
                  style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.bold),
                ),
                if (c.username != null) Text('@${c.username}', style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
                const SizedBox(height: 8),
                if (c.panNumber != null) _infoRow('PAN', c.panNumber!),
                if (c.bankAccountNumber != null) _infoRow('Bank a/c', '${c.bankAccountNumber} (${c.bankIfsc ?? '—'})'),
                if (c.city != null || c.state != null) _infoRow('Location', [c.city, c.state].whereType<String>().join(', ')),
                if (c.payoutFrequency != null) _infoRow('Payout freq.', c.payoutFrequency!),
                if (c.rejectionReason != null) _infoRow('Rejection reason', c.rejectionReason!),
                if (c.submittedAt != null) _infoRow('Submitted', formatTimeAgo(c.submittedAt)),
                if (c.documents.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: c.documents.entries
                        .map((e) => ActionChip(
                              label: Text(e.key.replaceAll('_', ' ')),
                              onPressed: () => _viewDocument(e.key.replaceAll('_', ' '), e.value),
                              backgroundColor: AppColors.backgroundDark,
                              labelStyle: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11),
                            ))
                        .toList(),
                  ),
                ],
                if (widget.tab == 'pending_review') ...[
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => _reject(c, index),
                        style: TextButton.styleFrom(foregroundColor: AppColors.error),
                        child: const Text('Reject'),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: () => _approve(c, index),
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandOrange),
                        child: const Text('Approve'),
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

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryDark),
          children: [
            TextSpan(text: '$label: ', style: const TextStyle(fontWeight: FontWeight.w600)),
            TextSpan(text: value),
          ],
        ),
      ),
    );
  }
}
