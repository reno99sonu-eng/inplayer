import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/premium_service.dart';

/// Real signed-in status pulled from GET /api/premium/me, shown alongside
/// the same benefits copy as app/lib/premiumPlans.ts. Actually buying or
/// renewing Premium needs a Razorpay checkout flow this app can't safely
/// build/verify without a compiler, so — same honest-link-out pattern as
/// Become a Member — the "Manage on website" button opens the real
/// Settings page where that checkout already works.
///
/// Prices are deliberately left off this screen, same restraint the
/// website itself uses (see premiumPlans.ts's publicPlan()): the benefits
/// are safe to show anywhere, the figure only appears once you're actually
/// starting a purchase, which happens on the website.
const List<String> _kPremiumBenefits = [
  '4K Ultra HD (2160p) streaming wherever the creator uploaded it',
  '2K (1440p) on supported videos — free accounts stop at 1080p',
  'The full quality ladder unlocked in Settings → Playback',
  'Everything InPlayer Free already includes',
];

const List<String> _kFreeBenefits = [
  'Unlimited streaming on InPlayer',
  'Video quality up to 1080p (Full HD)',
  'Upload your own videos & Shorts',
  'Comment, like and subscribe',
];

class PlansPurchasesPage extends ConsumerStatefulWidget {
  const PlansPurchasesPage({super.key});

  @override
  ConsumerState<PlansPurchasesPage> createState() => _PlansPurchasesPageState();
}

class _PlansPurchasesPageState extends ConsumerState<PlansPurchasesPage> {
  late Future<PremiumStatus> _statusFuture;

  @override
  void initState() {
    super.initState();
    _statusFuture = ref.read(premiumServiceProvider).getStatus();
  }

  Future<void> _openWebsite() async {
    final uri = Uri.parse('${ApiConstants.websiteOrigin}/settings');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  String _formatUntil(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    try {
      final date = DateTime.parse(iso);
      return DateFormat('MMM d, yyyy').format(date);
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text('Plans & Purchases',
            style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark)),
      ),
      body: FutureBuilder<PremiumStatus>(
        future: _statusFuture,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator(color: AppColors.brandOrange));
          }
          final status = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _buildStatusCard(status),
              const SizedBox(height: 20),
              Text(
                status.premium ? 'Your Premium benefits' : 'Premium benefits',
                style: const TextStyle(
                    color: AppColors.textPrimaryDark, fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 10),
              _buildBenefitsCard(_kPremiumBenefits, highlighted: true),
              const SizedBox(height: 20),
              const Text(
                'Free plan includes',
                style: TextStyle(
                    color: AppColors.textPrimaryDark, fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 10),
              _buildBenefitsCard(_kFreeBenefits, highlighted: false),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: _openWebsite,
                  icon: const Icon(Icons.open_in_new, size: 18),
                  label: Text(status.premium ? 'Manage on website' : 'Get Premium on website'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.brandOrange,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Center(
                child: Text(
                  'Purchases and renewals happen on inplayer.in',
                  style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStatusCard(PremiumStatus status) {
    final until = _formatUntil(status.premiumUntil);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: status.premium
            ? const LinearGradient(colors: [AppColors.brandOrange, AppColors.brandOrangeLight])
            : null,
        color: status.premium ? null : AppColors.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: status.premium ? null : Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          Icon(
            status.premium ? Icons.workspace_premium : Icons.workspace_premium_outlined,
            color: status.premium ? Colors.white : AppColors.textSecondaryDark,
            size: 36,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  status.premium ? 'InPlayer Premium' : 'InPlayer Free',
                  style: TextStyle(
                    color: status.premium ? Colors.white : AppColors.textPrimaryDark,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  status.premium
                      ? (until.isNotEmpty ? 'Active until $until' : 'Active')
                      : 'Up to ${status.maxResolution} streaming',
                  style: TextStyle(
                    color: status.premium ? Colors.white.withValues(alpha: 0.9) : AppColors.textSecondaryDark,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBenefitsCard(List<String> benefits, {required bool highlighted}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        children: [
          for (var i = 0; i < benefits.length; i++) ...[
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.check_circle,
                      size: 18, color: highlighted ? AppColors.brandOrange : AppColors.textSecondaryDark),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      benefits[i],
                      style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 13, height: 1.3),
                    ),
                  ),
                ],
              ),
            ),
            if (i != benefits.length - 1) const Divider(height: 1, color: Colors.white10),
          ],
        ],
      ),
    );
  }
}
