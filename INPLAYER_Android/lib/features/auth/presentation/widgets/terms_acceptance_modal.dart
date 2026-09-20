import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../providers/auth_provider.dart';

class TermsAcceptanceModalOverlay extends ConsumerStatefulWidget {
  const TermsAcceptanceModalOverlay({super.key});

  @override
  ConsumerState<TermsAcceptanceModalOverlay> createState() =>
      _TermsAcceptanceModalOverlayState();
}

class _TermsAcceptanceModalOverlayState
    extends ConsumerState<TermsAcceptanceModalOverlay> {
  bool _loading = false;
  String? _error;

  Future<void> _handleAccept() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final success =
          await ref.read(authStateProvider.notifier).acceptTerms();
      if (!success && mounted) {
        setState(() {
          _error = "Could not save your acceptance. Please try again.";
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = "An error occurred: $e";
          _loading = false;
        });
      }
    }
  }

  Future<void> _handleDecline() async {
    setState(() => _loading = true);
    await ref.read(authStateProvider.notifier).signOut();
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.85),
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 480),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF0C1427),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: AppColors.brandOrange.withValues(alpha: 0.4),
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.6),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.brandOrange.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.verified_user_outlined,
                          color: AppColors.brandOrange,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.brandOrange.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: AppColors.brandOrange.withValues(alpha: 0.3),
                          ),
                        ),
                        child: const Text(
                          'POLICY UPDATE • SEPT 5, 2026',
                          style: TextStyle(
                            color: AppColors.brandOrange,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Terms & Policies Update',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'To continue using InPlayer, please review and accept our updated platform terms and legal policies (Version 2026-09-05):',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 13,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildPolicyLink(
                    context,
                    title: 'Terms of Service',
                    path: '/settings/terms',
                  ),
                  _buildPolicyLink(
                    context,
                    title: 'Privacy Policy',
                    path: '/settings/privacy-policy',
                  ),
                  _buildPolicyLink(
                    context,
                    title: 'Copyright & Intellectual Property Policy',
                    path: '/settings/copyright-policy',
                  ),
                  _buildPolicyLink(
                    context,
                    title: 'Child Safety Policy',
                    path: '/settings/child-safety',
                  ),
                  _buildPolicyLink(
                    context,
                    title: 'Community Guidelines',
                    path: '/settings/community-guidelines',
                  ),
                  _buildPolicyLink(
                    context,
                    title: 'Creator Monetization Policy',
                    path: '/settings/monetization-policy',
                  ),
                  _buildPolicyLink(
                    context,
                    title: 'Online Chat & Messaging Policy',
                    path: '/settings/chat-messaging-policy',
                  ),
                  _buildPolicyLink(
                    context,
                    title: 'Strike, Suspension & Appeals Policy',
                    path: '/settings/strike-suspension-policy',
                  ),
                  _buildPolicyLink(
                    context,
                    title: 'Report, Complaint & Grievance Policy',
                    path: '/settings/report-grievance-policy',
                  ),
                  _buildPolicyLink(
                    context,
                    title: 'Advertising & Sponsorship Policy',
                    path: '/settings/advertising-sponsorship-policy',
                  ),
                  _buildPolicyLink(
                    context,
                    title: 'InPlayer MART Shop & Seller Policy',
                    path: '/settings/mart-seller-policy',
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: const TextStyle(
                        color: Colors.redAccent,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _loading ? null : _handleDecline,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white70,
                            side: BorderSide(
                              color: Colors.white.withValues(alpha: 0.25),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: const Text(
                            'Decline',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _loading ? null : _handleAccept,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.brandOrange,
                            foregroundColor: Colors.white,
                            elevation: 4,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: _loading
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text(
                                  'Accept & Continue',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPolicyLink(
    BuildContext context, {
    required String title,
    required String path,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        onTap: () => context.push(path),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 6),
          child: Row(
            children: [
              const Icon(
                Icons.check_circle_outline,
                size: 14,
                color: AppColors.brandOrange,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.brandOrange,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
              const Icon(
                Icons.arrow_forward_ios,
                size: 10,
                color: Colors.white38,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
