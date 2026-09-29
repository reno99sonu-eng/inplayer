import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/admin_sponsorship.dart';
import '../../../../services/admin_service.dart';

class AdminSponsorshipsTab extends ConsumerStatefulWidget {
  const AdminSponsorshipsTab({super.key});

  @override
  ConsumerState<AdminSponsorshipsTab> createState() => _AdminSponsorshipsTabState();
}

class _AdminSponsorshipsTabState extends ConsumerState<AdminSponsorshipsTab> {
  bool _loading = true;
  List<AdminSponsorship> _sponsorships = [];
  bool _tableMissing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getSponsorships();
    if (!mounted) return;
    setState(() {
      _sponsorships = result.items;
      _tableMissing = result.tableMissing;
      _error = result.error;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_tableMissing) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.monetization_on_outlined, size: 48, color: context.textDim),
              const SizedBox(height: 12),
              Text('Sponsorships Table Not Initialized', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Text('The sponsorships table in DynamoDB has not been created yet.', textAlign: TextAlign.center, style: TextStyle(color: context.textSecondary, fontSize: 12)),
            ],
          ),
        ),
      );
    }

    if (_error != null && !_loading) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off_outlined, size: 42, color: context.textDim),
              const SizedBox(height: 12),
              Text('Could not load sponsorships', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Text(_error!, textAlign: TextAlign.center, style: TextStyle(color: context.textSecondary, fontSize: 12)),
              const SizedBox(height: 12),
              OutlinedButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final totalAssets = _sponsorships.fold<int>(0, (sum, s) => sum + s.assetCount);
    final activeCount = _sponsorships.where((s) => s.status == 'active').length;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        color: AppColors.brandOrange,
        backgroundColor: context.bgCard,
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildKpiCards(context, totalAssets, activeCount),
                  ],
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
              )
            else if (_sponsorships.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.campaign_outlined, size: 48, color: context.textDim),
                      const SizedBox(height: 12),
                      Text('No sponsorship deals found', style: TextStyle(color: context.textSecondary)),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildSponsorshipCard(context, _sponsorships[index]),
                    childCount: _sponsorships.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCards(BuildContext context, int totalAssets, int activeCount) {
    return Row(
      children: [
        Expanded(
          child: _statCard(context, 'Campaigns', '${_sponsorships.length}', Icons.campaign_outlined, AppColors.brandOrange),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _statCard(context, 'Active Deals', '$activeCount', Icons.verified_outlined, const Color(0xFF10B981)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _statCard(context, 'Staged Assets', '$totalAssets', Icons.perm_media_outlined, const Color(0xFF06B6D4)),
        ),
      ],
    );
  }

  Widget _statCard(BuildContext context, String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 14),
              const SizedBox(width: 4),
              Text(label, style: TextStyle(color: context.textDim, fontSize: 10, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(color: context.textPrimary, fontSize: 15, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _buildSponsorshipCard(BuildContext context, AdminSponsorship s) {
    Color statusColor;
    switch (s.status) {
      case 'active':
        statusColor = const Color(0xFF10B981);
        break;
      case 'pending_payment':
      case 'awaiting_assets':
        statusColor = const Color(0xFFF59E0B);
        break;
      case 'cancelled':
        statusColor = const Color(0xFFEF4444);
        break;
      default:
        statusColor = context.textDim;
    }

    final amount = s.amountInr;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  s.companyName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  s.statusLabel.toUpperCase(),
                  style: TextStyle(color: statusColor, fontSize: 9.5, fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          if (s.contactName.isNotEmpty || s.contactEmail.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              [s.contactName, s.contactEmail].where((value) => value.isNotEmpty).join(' · '),
              style: TextStyle(color: context.textSecondary, fontSize: 11.5),
            ),
          ],
          if (s.packageLabel.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Package: ${s.packageLabel}',
              style: TextStyle(color: context.textPrimary, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
          if (s.sections.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text('Placements: ${s.sections.map((section) => section.replaceAll('_', ' ')).join(', ')}', style: TextStyle(color: context.textSecondary, fontSize: 11)),
          ],
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (amount != null)
                Text(
                  '₹$amount',
                  style: TextStyle(color: AppColors.brandOrangeLight, fontSize: 13, fontWeight: FontWeight.w800),
                )
              else
                Text(
                  'Budget: Open',
                  style: TextStyle(color: context.textDim, fontSize: 11),
                ),
              Row(
                children: [
                  Icon(Icons.image_outlined, color: context.textDim, size: 14),
                  const SizedBox(width: 4),
                  Text(
                    '${s.assetCount} asset${s.assetCount == 1 ? '' : 's'} staged',
                    style: TextStyle(color: context.textDim, fontSize: 11),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text('Payment: ${s.paymentStatus.replaceAll('_', ' ')}', style: TextStyle(color: context.textDim, fontSize: 10.5)),
          if (s.status == 'active' && s.expiresAt != null) ...[
            const SizedBox(height: 3),
            Text('Runs until ${_formatDate(s.expiresAt!)}', style: TextStyle(color: context.textSecondary, fontSize: 10.5)),
          ],
        ],
      ),
    );
  }

  String _formatDate(String value) {
    final date = DateTime.tryParse(value)?.toLocal();
    if (date == null) return value;
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '$day/$month/${date.year}';
  }
}
