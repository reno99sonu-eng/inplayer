import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/admin_analytics.dart';
import '../../../../models/admin_revenue.dart';
import '../widgets/admin_common.dart';

/// Analytics + Revenue — two read-only dashboards grouped into one section
/// since both are "numbers about the platform," mirroring
/// app/api/admin/analytics/route.ts and app/api/admin/revenue/route.ts.
class AdminAnalyticsTab extends StatelessWidget {
  const AdminAnalyticsTab({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Container(
            color: AppColors.backgroundDark,
            child: const TabBar(
              indicatorColor: AppColors.brandOrange,
              labelColor: AppColors.brandOrange,
              unselectedLabelColor: AppColors.textSecondaryDark,
              tabs: [Tab(text: 'Analytics'), Tab(text: 'Revenue')],
            ),
          ),
          const Expanded(
            child: TabBarView(children: [_AnalyticsView(), _RevenueView()]),
          ),
        ],
      ),
    );
  }
}

String _formatCount(num n) {
  if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
  if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
  return '${n.toInt()}';
}

String _formatInr(num n) => '₹${n.toStringAsFixed(2)}';

class _AnalyticsView extends ConsumerStatefulWidget {
  const _AnalyticsView();

  @override
  ConsumerState<_AnalyticsView> createState() => _AnalyticsViewState();
}

class _AnalyticsViewState extends ConsumerState<_AnalyticsView> {
  bool _loading = true;
  AdminAnalytics? _stats;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final stats = await ref.read(adminServiceProvider).getAnalytics();
    if (!mounted) return;
    setState(() {
      _stats = stats;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    final stats = _stats;
    if (stats == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.error, size: 48),
            const SizedBox(height: 12),
            const Text('Failed to load analytics', style: TextStyle(color: AppColors.textSecondaryDark)),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }

    final cards = [
      (label: 'Users', value: _formatCount(stats.totalUsers)),
      (label: 'Videos', value: _formatCount(stats.totalVideos)),
      (label: 'Shorts', value: _formatCount(stats.totalShorts)),
      (label: 'Lifetime Views', value: _formatCount(stats.lifetimeViews)),
      (label: 'Lifetime Shares', value: _formatCount(stats.lifetimeShares)),
      (label: 'Likes', value: _formatCount(stats.totalLikes)),
      (label: 'Comments', value: _formatCount(stats.totalComments)),
      (label: 'Subscriptions', value: _formatCount(stats.totalSubscriptions)),
    ];

    final maxViews = stats.viewsTrend.fold<int>(1, (m, p) => p.views > m ? p.views : m);

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.8,
            children: cards
                .map((c) => Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(16)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(c.value,
                              style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 20)),
                          Text(c.label, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
                        ],
                      ),
                    ))
                .toList(),
          ),
          if (stats.viewsTrend.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Views — last 7 days', style: TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(16)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: stats.viewsTrend.map((p) {
                  final heightFrac = maxViews == 0 ? 0.0 : p.views / maxViews;
                  final day = p.date.length >= 10 ? p.date.substring(5) : p.date;
                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('${p.views}', style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 10)),
                      const SizedBox(height: 4),
                      Container(
                        width: 20,
                        height: 60 * heightFrac + 4,
                        decoration: BoxDecoration(
                          color: AppColors.brandOrange,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(day, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 10)),
                    ],
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _RevenueView extends ConsumerStatefulWidget {
  const _RevenueView();

  @override
  ConsumerState<_RevenueView> createState() => _RevenueViewState();
}

class _RevenueViewState extends ConsumerState<_RevenueView> {
  bool _loading = true;
  AdminRevenueResult? _result;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getRevenue();
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
      return const AdminTableMissingNotice(
        message: "Revenue ledger / payouts tables haven't been created in AWS yet.",
      );
    }

    final summary = result.summary;

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (summary != null) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(16)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _row('Gross revenue', _formatInr(summary.totalGrossInr)),
                  _row('Creator share', _formatInr(summary.totalCreatorShareInr)),
                  _row('Platform share', _formatInr(summary.totalPlatformShareInr)),
                  _row('Charges', '${summary.totalCharges}'),
                  _row('Active memberships', '${summary.activeMemberships}'),
                  _row('Verified creators', '${summary.verifiedCreatorCount}'),
                  const Divider(color: AppColors.backgroundDark, height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(summary.payoutWindowLabel ?? 'Payout window',
                          style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 13)),
                      AdminStatusPill(
                        label: summary.payoutWindowOpen ? 'Open' : 'Closed',
                        color: summary.payoutWindowOpen ? AppColors.success : AppColors.textSecondaryDark,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          const Text('Creators', style: TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (result.creators.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: AdminEmptyState(message: 'No creators with payout activity yet'),
            )
          else
            ...result.creators.map((c) => Card(
                  color: AppColors.cardDark,
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(
                      c.username != null ? '@${c.username}' : c.userId,
                      style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600),
                    ),
                    subtitle: Text(
                      'Earned ${_formatInr(c.lifetimeEarnedInr)} • Pending ${_formatInr(c.pendingPayoutInr)}',
                      style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
                    ),
                    trailing: AdminStatusPill(
                      label: c.kycStatus.replaceAll('_', ' '),
                      color: c.kycStatus == 'verified'
                          ? AppColors.success
                          : c.kycStatus == 'rejected'
                              ? AppColors.error
                              : AppColors.brandOrange,
                    ),
                  ),
                )),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 13)),
          Text(value, style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
