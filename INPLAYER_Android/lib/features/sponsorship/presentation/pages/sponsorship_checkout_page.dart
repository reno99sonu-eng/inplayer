import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/sponsorship_service.dart';

class SponsorshipCheckoutPage extends ConsumerStatefulWidget {
  const SponsorshipCheckoutPage({super.key});

  @override
  ConsumerState<SponsorshipCheckoutPage> createState() => _SponsorshipCheckoutPageState();
}

class _SponsorshipCheckoutPageState extends ConsumerState<SponsorshipCheckoutPage> {
  late final Razorpay _razorpay;
  final _formKey = GlobalKey<FormState>();
  final _companyController = TextEditingController();
  final _contactNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _websiteController = TextEditingController();
  final _legalNameController = TextEditingController();
  final _panController = TextEditingController();
  final _addressController = TextEditingController();

  String _packageType = 'bundle';
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);

    final auth = ProviderScope.containerOf(context, listen: false).read(authStateProvider);
    if (auth is AuthStateAuthenticated) {
      final user = auth.user;
      if (user.email.isNotEmpty) {
        _emailController.text = user.email;
      }
      if ((user.phoneNumber ?? '').trim().isNotEmpty) {
        _phoneController.text = user.phoneNumber!.trim();
      }
    }
  }

  @override
  void dispose() {
    _razorpay.clear();
    _companyController.dispose();
    _contactNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _websiteController.dispose();
    _legalNameController.dispose();
    _panController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final auth = ref.read(authStateProvider);
    if (auth is! AuthStateAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please sign in to sponsor an ad.')),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      final email = _emailController.text.trim();
      final phone = _phoneController.text.trim();
      final checkout = await ref.read(sponsorshipServiceProvider).createCheckout(
        packageType: _packageType,
        companyName: _companyController.text.trim(),
        contactName: _contactNameController.text.trim(),
        contactEmail: email,
        contactPhone: phone.isNotEmpty ? phone : (auth.user.phoneNumber ?? '').trim(),
        websiteUrl: _websiteController.text.trim(),
        legalName: _legalNameController.text.trim(),
        panOrGst: _panController.text.trim(),
        businessAddress: _addressController.text.trim(),
      );

      if (!mounted) return;
      _razorpay.open({
        'key': checkout.razorpayKeyId,
        'amount': checkout.amountInr * 100,
        'order_id': checkout.razorpayOrderId,
        'name': 'InPlayer Sponsorship',
        'description': 'Sponsorship package',
        'prefill': {
          if (email.isNotEmpty) 'email': email,
          if (phone.isNotEmpty) 'contact': phone,
        },
        'theme': {'color': '#F97316'},
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _onPaymentSuccess(PaymentSuccessResponse response) {
    if (!mounted) return;
    context.pushReplacement('/sponsorships/success?orderId=${response.orderId ?? 'unknown'}');
  }

  void _onPaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    final message = response.message?.trim().isNotEmpty == true
        ? response.message!
        : 'Payment failed or was cancelled.';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${response.walletName ?? 'Wallet'} selected. Complete the payment in the wallet app.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final packageOptions = [
      {'value': 'bundle', 'label': 'Entire InPlayer', 'price': '₹7,000'},
      {'value': 'midroll', 'label': 'Mid-roll video ad', 'price': '₹2,500'},
      {'value': 'homepage_banner', 'label': 'Homepage banner', 'price': '₹1,800'},
      {'value': 'watch_banner', 'label': 'Watch page banner', 'price': '₹1,800'},
    ];

    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        iconTheme: IconThemeData(color: context.textPrimary),
        title: Text('Sponsor an Ad', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: [AppColors.brandOrange.withValues(alpha: .95), const Color(0xFF9A3412)]),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [BoxShadow(color: AppColors.brandOrange.withValues(alpha: .24), blurRadius: 24, offset: const Offset(0, 10))],
                  ),
                  child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(Icons.campaign_rounded, color: Colors.white, size: 30),
                    SizedBox(height: 14),
                    Text('Make your brand impossible to miss.', style: TextStyle(color: Colors.white, fontSize: 23, height: 1.08, fontWeight: FontWeight.w900)),
                    SizedBox(height: 8),
                    Text('Reach the InPlayer community across the moments that matter.', style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.35)),
                  ]),
                ),
                const SizedBox(height: 22),
                Text(
                  'Choose your campaign',
                  style: TextStyle(color: context.textPrimary, fontSize: 22, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: packageOptions.map((item) {
                    final selected = _packageType == item['value'];
                    return ChoiceChip(
                      label: Text('${item['label']} • ${item['price']}'),
                      selected: selected,
                      selectedColor: AppColors.brandOrange.withValues(alpha: 0.15),
                      onSelected: (_) => setState(() => _packageType = item['value'] as String),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),
                Text('Business details', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                _field('Company name', _companyController, validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null),
                _field('Contact name', _contactNameController, validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null),
                _field('Contact email', _emailController, keyboardType: TextInputType.emailAddress, validator: (v) => (v == null || !v.contains('@')) ? 'Valid email required' : null),
                _field('Contact phone', _phoneController, keyboardType: TextInputType.phone, validator: (v) => (v == null || v.trim().length < 10) ? 'Valid phone required' : null),
                _field('Website URL', _websiteController, validator: (v) => (v == null || !v.startsWith('http')) ? 'Valid website required' : null),
                _field('Legal name', _legalNameController, validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null),
                _field('PAN / GST', _panController, validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null),
                _field('Business address', _addressController, maxLines: 3, validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: _submitting ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.lock_outline),
                    label: Text(_submitting ? 'Preparing checkout...' : 'Pay now'),
                    style: FilledButton.styleFrom(backgroundColor: AppColors.brandOrange, padding: const EdgeInsets.symmetric(vertical: 16)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    String? Function(String?)? validator,
    TextInputType? keyboardType,
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        maxLines: maxLines,
        style: TextStyle(color: context.textPrimary),
        validator: validator,
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: context.borderSubtle),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: AppColors.brandOrange),
          ),
        ),
      ),
    );
  }
}
