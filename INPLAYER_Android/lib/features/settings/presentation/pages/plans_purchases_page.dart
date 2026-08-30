import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
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

enum _Stage { browse, confirm, paying, activating, active, pending, error }

class _PlansPurchasesPageState extends ConsumerState<PlansPurchasesPage> {
  late final Razorpay _razorpay;
  PremiumStatus? _status;
  List<PremiumPlan> _plans = [];
  bool _loading = true;

  _Stage _stage = _Stage.browse;
  PremiumPlan? _chosen;
  String? _error;
  String? _grantedUntil;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
    _loadData();
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait<Object>([
        ref.read(premiumServiceProvider).getStatus(),
        ref.read(premiumServiceProvider).getPlans(),
      ]);
      if (!mounted) return;
      setState(() {
        _status = results[0] as PremiumStatus;
        _plans = results[1] as List<PremiumPlan>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  void _choosePlan(PremiumPlan plan) {
    final auth = ref.read(authStateProvider);
    if (auth is! AuthStateAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please sign in to see pricing and purchase.'),
          backgroundColor: context.isDark
              ? AppColors.surfaceDark
              : AppColors.surfaceLight,
        ),
      );
      return;
    }
    setState(() {
      _chosen = plan;
      _error = null;
      _stage = _Stage.confirm;
    });
  }

  Future<void> _pay() async {
    if (_chosen == null) return;
    setState(() {
      _error = null;
      _stage = _Stage.paying;
    });

    try {
      final checkout = await ref
          .read(premiumServiceProvider)
          .createCheckout(_chosen!.planId);
      final auth = ref.read(authStateProvider);
      final email = auth is AuthStateAuthenticated ? auth.user.email : '';
      final phone = auth is AuthStateAuthenticated ? auth.user.phoneNumber : null;
      _razorpay.open({
        'key': checkout.razorpayKeyId,
        'amount': checkout.amountInr * 100, // paise
        'order_id': checkout.razorpayOrderId,
        'name': 'InPlayer',
        'description': checkout.planLabel,
        'prefill': {
          if (email.isNotEmpty) 'email': email,
          if ((phone ?? '').trim().isNotEmpty) 'contact': phone!.trim(),
        },
        'theme': {'color': '#F97316'},
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err.toString();
        _stage = _Stage.error;
      });
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    if (!mounted) return;
    setState(() {
      _stage = _Stage.activating;
    });

    for (var attempt = 0; attempt < 12; attempt++) {
      await Future<void>.delayed(const Duration(seconds: 2));
      final status = await ref.read(premiumServiceProvider).getStatus();
      if (status.premium) {
        if (!mounted) return;
        setState(() {
          _grantedUntil = status.premiumUntil;
          _stage = _Stage.active;
        });
        _loadData();
        return;
      }
    }
    if (!mounted) return;
    setState(() => _stage = _Stage.pending);
    _loadData();
  }

  void _onPaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    final detail = response.message?.trim();
    setState(() {
      _error = (detail == null || detail.isEmpty)
          ? 'Payment was closed before finishing — nothing was charged.'
          : detail;
      _stage = _Stage.error;
    });
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    setState(() {
      _error =
          '${response.walletName} selected. Complete payment in the wallet app.';
      _stage = _Stage.error;
    });
  }

  String _formatDate(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    try {
      return DateFormat('MMMM d, yyyy').format(DateTime.parse(iso));
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentlyPremium = _status != null && _status!.premium;
    final renewalLabel = _formatDate(_status?.premiumUntil);

    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        iconTheme: IconThemeData(color: context.textPrimary),
        title: Text(
          'Plans & Purchases',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: context.textPrimary,
            fontSize: 18,
          ),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange),
            )
          : ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                _buildSettingsCard(
                  icon: Icons.workspace_premium,
                  title: 'Plans & Purchases',
                  description: 'Manage your InPlayer membership.',
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: context.isDark
                          ? Colors.white.withValues(alpha: 0.03)
                          : Colors.black.withValues(alpha: 0.03),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: context.isDark
                            ? Colors.white.withValues(alpha: 0.1)
                            : Colors.black.withValues(alpha: 0.1),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'CURRENT PLAN',
                                    style: TextStyle(
                                      color: context.textSecondary,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1.5,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    currentlyPremium
                                        ? 'InPlayer Premium'
                                        : 'InPlayer Free',
                                    style: TextStyle(
                                      color: context.textPrimary,
                                      fontSize: 24,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  if (currentlyPremium &&
                                      renewalLabel.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Text(
                                        'Premium until $renewalLabel',
                                        style: TextStyle(
                                          color: context.textSecondary,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: currentlyPremium
                                    ? AppColors.brandOrange.withValues(
                                        alpha: 0.15,
                                      )
                                    : (context.isDark
                                          ? Colors.white.withValues(alpha: 0.05)
                                          : Colors.black.withValues(
                                              alpha: 0.04,
                                            )),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: currentlyPremium
                                      ? AppColors.brandOrange.withValues(
                                          alpha: 0.4,
                                        )
                                      : (context.isDark
                                            ? Colors.white.withValues(
                                                alpha: 0.15,
                                              )
                                            : Colors.black.withValues(
                                                alpha: 0.15,
                                              )),
                                ),
                              ),
                              child: Text(
                                'Active',
                                style: TextStyle(
                                  color: currentlyPremium
                                      ? AppColors.brandOrange
                                      : context.textSecondary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        for (final feature
                            in (currentlyPremium
                                ? _premiumBenefits
                                : _freeBenefits))
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  Icons.check,
                                  size: 16,
                                  color: context.textSecondary,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    feature,
                                    style: TextStyle(
                                      color: context.textSecondary,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                _buildSettingsCard(
                  icon: Icons.auto_awesome,
                  title: 'InPlayer Premium',
                  description: 'Unlock the full InPlayer experience.',
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.brandOrange.withValues(alpha: 0.06),
                          Colors.transparent,
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppColors.brandOrange.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final feature in _premiumBenefits)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.check,
                                  size: 16,
                                  color: AppColors.brandOrange,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    feature,
                                    style: TextStyle(
                                      color: context.textPrimary,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        const SizedBox(height: 12),
                        if (currentlyPremium && _stage != _Stage.active) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              color: AppColors.brandOrange.withValues(
                                alpha: 0.08,
                              ),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: AppColors.brandOrange.withValues(
                                  alpha: 0.2,
                                ),
                              ),
                            ),
                            child: Text(
                              'Premium is active on your account${renewalLabel.isNotEmpty ? ' until $renewalLabel' : ''}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: AppColors.brandOrange,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          if (_stage == _Stage.browse)
                            _buildPlanGrid(label: 'Add more time'),
                          if (_stage != _Stage.browse) _buildCheckoutPanel(),
                        ] else ...[
                          if (_stage == _Stage.browse) ...[
                            _buildPlanGrid(
                              label:
                                  ref.read(authStateProvider)
                                      is AuthStateAuthenticated
                                  ? 'Choose a plan'
                                  : 'Sign in to see pricing',
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'Pricing is shown at checkout. One payment — nothing recurring, no card stored, no auto-renewal.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.grey,
                                fontSize: 12,
                              ),
                            ),
                          ],
                          if (_stage != _Stage.browse) _buildCheckoutPanel(),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
    );
  }

  Widget _buildSettingsCard({
    required IconData icon,
    required String title,
    required String description,
    required Widget child,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: context.textPrimary, size: 24),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  description,
                  style: TextStyle(color: context.textSecondary, fontSize: 13),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),
        child,
      ],
    );
  }

  Widget _buildPlanGrid({required String label}) {
    if (_plans.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: CircularProgressIndicator(color: AppColors.brandOrange),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            color: context.textSecondary,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 8),
        for (final plan in _plans)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: InkWell(
              onTap: () => _choosePlan(plan),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: context.isDark
                      ? Colors.white.withValues(alpha: 0.04)
                      : Colors.black.withValues(alpha: 0.03),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: context.isDark
                        ? Colors.white.withValues(alpha: 0.1)
                        : Colors.black.withValues(alpha: 0.1),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          plan.label,
                          style: TextStyle(
                            color: context.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        if (plan.badge != null)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.brandOrange.withValues(
                                alpha: 0.2,
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              plan.badge!.toUpperCase(),
                              style: const TextStyle(
                                color: AppColors.brandOrange,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      plan.cadence,
                      style: TextStyle(
                        color: context.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Continue — see price →',
                      style: TextStyle(
                        color: AppColors.brandOrange,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildCheckoutPanel() {
    if (_stage == _Stage.activating) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              const CircularProgressIndicator(color: AppColors.brandOrange),
              const SizedBox(height: 16),
              Text(
                'Confirming your payment…',
                style: TextStyle(
                  color: context.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'This usually takes a few seconds.',
                style: TextStyle(color: context.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
      );
    }
    if (_stage == _Stage.active) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              const Icon(Icons.check_circle, color: Colors.green, size: 32),
              const SizedBox(height: 16),
              Text(
                'You\'re on InPlayer Premium',
                style: TextStyle(
                  color: context.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${_grantedUntil != null ? 'Active until ${_formatDate(_grantedUntil)}.' : 'Your account has been upgraded.'} 4K and 2K unlock the next time a video loads.',
                textAlign: TextAlign.center,
                style: TextStyle(color: context.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
      );
    }
    if (_stage == _Stage.pending) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              const CircularProgressIndicator(color: AppColors.brandOrange),
              const SizedBox(height: 16),
              Text(
                'Payment received — finishing up',
                style: TextStyle(
                  color: context.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Your bank has confirmed it but our side is still catching up. Premium will switch on by itself within a few minutes — nothing else to do.',
                textAlign: TextAlign.center,
                style: TextStyle(color: context.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => setState(() => _stage = _Stage.browse),
                child: const Text(
                  'Back to plans',
                  style: TextStyle(color: AppColors.brandOrange),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final busy = _stage == _Stage.paying;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextButton.icon(
          onPressed: busy
              ? null
              : () => setState(() {
                  _stage = _Stage.browse;
                  _error = null;
                }),
          icon: const Icon(Icons.arrow_back, size: 14),
          label: const Text('Back to plans'),
          style: TextButton.styleFrom(
            foregroundColor: context.textSecondary,
            textStyle: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: context.isDark
                ? Colors.white.withValues(alpha: 0.03)
                : Colors.black.withValues(alpha: 0.03),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: context.isDark
                  ? Colors.white.withValues(alpha: 0.1)
                  : Colors.black.withValues(alpha: 0.1),
            ),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'InPlayer Premium · ${_chosen?.label}',
                          style: TextStyle(
                            color: context.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(
                          '${_chosen?.durationDays} days from the moment it activates',
                          style: TextStyle(
                            color: context.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    _chosen?.amountInr == null
                        ? '—'
                        : '₹${NumberFormat.decimalPattern('en_IN').format(_chosen!.amountInr)}',
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Divider(height: 1, color: context.borderSubtle),
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Colors.red.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.warning_amber_rounded,
                        color: Colors.redAccent,
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _error!,
                          style: const TextStyle(
                            color: Colors.redAccent,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: busy ? null : _pay,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.brandOrange,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          _chosen?.amountInr == null
                              ? 'Continue to payment'
                              : 'Pay ₹${NumberFormat.decimalPattern('en_IN').format(_chosen!.amountInr)}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'One payment. Nothing is stored or charged again — buy more time whenever you want it.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey, fontSize: 11),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
