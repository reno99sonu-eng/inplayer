import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/creator_payout_status.dart';
import '../../../../services/creator_monetization_service.dart';

class CreatorMonetizationPage extends ConsumerStatefulWidget {
  const CreatorMonetizationPage({super.key});

  @override
  ConsumerState<CreatorMonetizationPage> createState() => _CreatorMonetizationPageState();
}

class _CreatorMonetizationPageState extends ConsumerState<CreatorMonetizationPage> {
  bool _loading = true;
  CreatorPayoutStatus? _status;
  CreatorMonetizationState? _monetizationState;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);

    final service = ref.read(creatorMonetizationServiceProvider);
    final status = await service.getPayoutStatus();
    final monetization = await service.getMonetizationStatus();

    if (!mounted) return;
    setState(() {
      _status = status;
      _monetizationState = monetization;
      _loading = false;
    });
  }

  Future<void> _activateMonetization() async {
    final result = await ref.read(creatorMonetizationServiceProvider).activateMonetization();
    if (!mounted) return;
    if (result['success'] == true) {
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Monetization activated.')),
      );
      return;
    }

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result['error']?.toString() ?? 'Could not activate monetization.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: context.bgCanvas,
        appBar: AppBar(
          backgroundColor: context.bgCanvas,
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          title: Text('Monetization', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
        ),
        body: const Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
      );
    }

    final status = _status ?? const CreatorPayoutStatus();
    final monetizationStatus = _monetizationState ?? const CreatorMonetizationState();
    final kycState = status.kycStatus;

    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        iconTheme: IconThemeData(color: context.textPrimary),
        title: Text('Monetization', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _InfoCard(
            title: 'Monetization status',
            value: monetizationStatus.status,
            accent: _accentForMonetization(monetizationStatus.status),
          ),
          const SizedBox(height: 16),
          _InfoCard(
            title: 'KYC status',
            value: kycState.replaceAll('_', ' '),
            accent: _accentForKyc(kycState),
          ),
          const SizedBox(height: 16),
          Card(
            color: context.bgCard,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Earnings', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  _MetricRow(label: 'Lifetime earned', value: '₹${status.lifetimeEarnedInr}'),
                  _MetricRow(label: 'Lifetime paid out', value: '₹${status.lifetimePaidOutInr}'),
                  _MetricRow(label: 'Min payout', value: '₹${status.minPayoutAmount}'),
                  if (status.payoutFrequency != null) _MetricRow(label: 'Payout frequency', value: status.payoutFrequency!),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (kycState == 'not_started')
            FilledButton.icon(
              onPressed: () => context.push('/creator/kyc'),
              icon: const Icon(Icons.badge_outlined),
              label: const Text('Submit KYC'),
              style: FilledButton.styleFrom(backgroundColor: AppColors.brandOrange, padding: const EdgeInsets.symmetric(vertical: 16)),
            )
          else if (kycState == 'pending_review')
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.brandOrange.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                'Your KYC is being reviewed by the admin team. You will be notified once it is approved.',
                style: TextStyle(color: context.textPrimary),
              ),
            )
          else if (kycState == 'rejected')
            Column(
              children: [
                Text(
                  status.rejectionReason ?? 'Your KYC was rejected. Please resubmit the required details.',
                  style: TextStyle(color: context.textSecondary),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () => context.push('/creator/kyc'),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Resubmit KYC'),
                  style: FilledButton.styleFrom(backgroundColor: AppColors.brandOrange, padding: const EdgeInsets.symmetric(vertical: 16)),
                ),
              ],
            )
          else
            Column(
              children: [
                Text(
                  'Your KYC is approved. You can activate creator monetization when your channel becomes eligible.',
                  style: TextStyle(color: context.textSecondary),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: _activateMonetization,
                  icon: const Icon(Icons.auto_awesome),
                  label: const Text('Activate monetization'),
                  style: FilledButton.styleFrom(backgroundColor: AppColors.brandOrange, padding: const EdgeInsets.symmetric(vertical: 16)),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Color _accentForKyc(String status) {
    switch (status) {
      case 'verified':
        return AppColors.success;
      case 'pending_review':
        return AppColors.warning;
      case 'rejected':
        return AppColors.error;
      default:
        return AppColors.textSecondaryDark;
    }
  }

  Color _accentForMonetization(String status) {
    switch (status) {
      case 'MONETIZED':
        return AppColors.success;
      case 'ELIGIBLE':
        return AppColors.brandOrange;
      default:
        return AppColors.textSecondaryDark;
    }
  }
}

class _InfoCard extends StatelessWidget {
  final String title;
  final String value;
  final Color accent;

  const _InfoCard({required this.title, required this.value, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: context.bgCard,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: TextStyle(color: context.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(color: accent, fontSize: 20, fontWeight: FontWeight.w900),
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricRow extends StatelessWidget {
  final String label;
  final String value;

  const _MetricRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: context.textSecondary)),
          Text(value, style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
