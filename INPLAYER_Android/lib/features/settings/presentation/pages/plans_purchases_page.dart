import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/premium_service.dart';

const _premiumBenefits = [
  '4K Ultra HD (2160p) streaming wherever the creator uploaded it',
  '2K (1440p) on supported videos — free accounts stop at 1080p',
  'The full quality ladder unlocked in Settings → Playback',
  'Everything InPlayer Free already includes',
];

const _freeBenefits = [
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
  late final Razorpay _razorpay;
  late Future<_PlansData> _dataFuture;
  bool _checkoutBusy = false;
  String? _pendingPlanLabel;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
    _dataFuture = _loadData();
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  Future<_PlansData> _loadData() async {
    final results = await Future.wait<Object>([
      ref.read(premiumServiceProvider).getStatus(),
      ref.read(premiumServiceProvider).getPlans(),
    ]);
    return _PlansData(
      status: results[0] as PremiumStatus,
      plans: results[1] as List<PremiumPlan>,
    );
  }

  void _reload() => setState(() => _dataFuture = _loadData());

  Future<void> _startCheckout(PremiumPlan plan) async {
    if (_checkoutBusy) return;
    setState(() {
      _checkoutBusy = true;
      _pendingPlanLabel = plan.label;
    });

    try {
      final checkout = await ref
          .read(premiumServiceProvider)
          .createCheckout(plan.planId);
      final auth = ref.read(authStateProvider);
      final email = auth is AuthStateAuthenticated ? auth.user.email : '';
      _razorpay.open({
        'key': checkout.razorpayKeyId,
        'amount': checkout.amountInr * 100, // Razorpay expects paise.
        'order_id': checkout.razorpayOrderId,
        'name': 'InPlayer',
        'description': checkout.planLabel,
        'prefill': {if (email.isNotEmpty) 'email': email},
        'theme': {'color': '#F97316'},
      });
    } on PremiumServiceException catch (error) {
      _showMessage(error.message, error: true);
      if (mounted) setState(() => _checkoutBusy = false);
    } catch (_) {
      _showMessage(
        'Could not open secure checkout. Please try again.',
        error: true,
      );
      if (mounted) setState(() => _checkoutBusy = false);
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    if (!mounted) return;
    _showMessage(
      'Payment received. Activating ${_pendingPlanLabel ?? 'Premium'} after secure confirmation…',
    );

    // A checkout callback is not proof of entitlement. The website and this
    // app wait for the signed Razorpay webhook to write the server state.
    for (var attempt = 0; attempt < 12; attempt++) {
      await Future<void>.delayed(const Duration(seconds: 2));
      final status = await ref.read(premiumServiceProvider).getStatus();
      if (status.premium) {
        if (!mounted) return;
        setState(() {
          _checkoutBusy = false;
          _pendingPlanLabel = null;
          _dataFuture = _loadData();
        });
        _showMessage(
          'InPlayer Premium is active. Enjoy the full quality ladder!',
        );
        return;
      }
    }

    if (!mounted) return;
    setState(() => _checkoutBusy = false);
    _showMessage(
      'Payment was submitted. Premium will appear here once Razorpay confirms it.',
    );
    _reload();
  }

  void _onPaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(() => _checkoutBusy = false);
    final detail = response.message?.trim();
    _showMessage(
      detail == null || detail.isEmpty ? 'Payment was not completed.' : detail,
      error: true,
    );
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    _showMessage(
      '${response.walletName} selected. Complete payment in the wallet app.',
    );
  }

  void _showMessage(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? AppColors.error : AppColors.surfaceDark,
      ),
    );
  }

  String _formatUntil(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    try {
      return DateFormat('MMM d, yyyy').format(DateTime.parse(iso));
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
        title: const Text(
          'Plans & Purchases',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
      ),
      body: FutureBuilder<_PlansData>(
        future: _dataFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange),
            );
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.error_outline,
                      color: AppColors.error,
                      size: 42,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'We could not load plans right now.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textPrimaryDark),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: _reload,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          final data = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _buildStatusCard(data.status),
              const SizedBox(height: 20),
              Text(
                data.status.premium
                    ? 'Your Premium benefits'
                    : 'Premium benefits',
                style: const TextStyle(
                  color: AppColors.textPrimaryDark,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 10),
              _buildBenefitsCard(_premiumBenefits, highlighted: true),
              const SizedBox(height: 20),
              const Text(
                'Choose a plan',
                style: TextStyle(
                  color: AppColors.textPrimaryDark,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 10),
              ...data.plans.map(_buildPlanCard),
              const SizedBox(height: 20),
              const Text(
                'Free plan includes',
                style: TextStyle(
                  color: AppColors.textPrimaryDark,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 10),
              _buildBenefitsCard(_freeBenefits, highlighted: false),
              const SizedBox(height: 24),
              const Text(
                'Payments are securely processed by Razorpay. Premium is activated only after payment confirmation.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.textSecondaryDark,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 24),
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
            ? const LinearGradient(
                colors: [AppColors.brandOrange, AppColors.brandOrangeLight],
              )
            : null,
        color: status.premium ? null : AppColors.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: status.premium
            ? null
            : Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          Icon(
            status.premium
                ? Icons.workspace_premium
                : Icons.workspace_premium_outlined,
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
                    color: status.premium
                        ? Colors.white
                        : AppColors.textPrimaryDark,
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
                    color: status.premium
                        ? Colors.white.withValues(alpha: 0.9)
                        : AppColors.textSecondaryDark,
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

  Widget _buildPlanCard(PremiumPlan plan) {
    final amount = plan.amountInr == null
        ? ''
        : '₹${NumberFormat.decimalPattern('en_IN').format(plan.amountInr)}';
    final detail = [
      amount,
      plan.cadence,
      if (plan.durationDays > 0) '${plan.durationDays} days',
    ].where((item) => item.isNotEmpty).join(' · ');
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.brandOrange.withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.workspace_premium_outlined,
            color: AppColors.brandOrange,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plan.label,
                  style: const TextStyle(
                    color: AppColors.textPrimaryDark,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  style: const TextStyle(
                    color: AppColors.textSecondaryDark,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: _checkoutBusy ? null : () => _startCheckout(plan),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.brandOrange,
              foregroundColor: Colors.white,
            ),
            child: _checkoutBusy && _pendingPlanLabel == plan.label
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Choose'),
          ),
        ],
      ),
    );
  }

  Widget _buildBenefitsCard(
    List<String> benefits, {
    required bool highlighted,
  }) {
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
                  Icon(
                    Icons.check_circle,
                    size: 18,
                    color: highlighted
                        ? AppColors.brandOrange
                        : AppColors.textSecondaryDark,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      benefits[i],
                      style: const TextStyle(
                        color: AppColors.textPrimaryDark,
                        fontSize: 13,
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (i != benefits.length - 1)
              const Divider(height: 1, color: Colors.white10),
          ],
        ],
      ),
    );
  }
}

class _PlansData {
  final PremiumStatus status;
  final List<PremiumPlan> plans;

  const _PlansData({required this.status, required this.plans});
}
