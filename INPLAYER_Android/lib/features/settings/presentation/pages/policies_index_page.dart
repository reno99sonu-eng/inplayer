import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../data/legal_policies_data.dart' show LegalPolicyRepository;

/// The single "InPlayer Policies" entry point — replaces a Settings/drawer
/// menu that used to list every one of InPlayer's 11 legal documents as
/// its own separate row. Each document itself is unchanged (still its own
/// full AppLegalPage, sourced from LegalPolicyRepository) — this is just
/// one place to find all of them instead of eleven menu rows.
class PoliciesIndexPage extends StatelessWidget {
  const PoliciesIndexPage({super.key});

  // Maps each LegalPolicyRepository doc id to its existing GoRoute path
  // (see app_router.dart) and an icon, in the same order the old
  // Settings "Legal" section listed them.
  static const _routeByPolicyId = {
    'terms': '/settings/terms',
    'privacy': '/settings/privacy-policy',
    'copyright': '/settings/copyright-policy',
    'child-safety': '/settings/child-safety',
    'community-guidelines': '/settings/community-guidelines',
    'creator-monetization': '/settings/monetization-policy',
    'chat-messaging': '/settings/chat-messaging-policy',
    'strikes-appeals': '/settings/strike-suspension-policy',
    'report-grievance': '/settings/report-grievance-policy',
    'advertising-sponsorship': '/settings/advertising-sponsorship-policy',
    'mart-seller': '/settings/mart-seller-policy',
  };

  static const _iconByPolicyId = {
    'terms': Icons.description_outlined,
    'privacy': Icons.privacy_tip_outlined,
    'copyright': Icons.copyright_outlined,
    'child-safety': Icons.child_care_outlined,
    'community-guidelines': Icons.groups_outlined,
    'creator-monetization': Icons.monetization_on_outlined,
    'chat-messaging': Icons.forum_outlined,
    'strikes-appeals': Icons.gavel_outlined,
    'report-grievance': Icons.feedback_outlined,
    'advertising-sponsorship': Icons.campaign_outlined,
    'mart-seller': Icons.storefront_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final policies = LegalPolicyRepository.getAllPolicies();

    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          title: Text(
            'InPlayer Policies',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: context.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
        ),
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 820),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: policies.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final doc = policies[index];
                  final route = _routeByPolicyId[doc.id];
                  final icon = _iconByPolicyId[doc.id] ?? Icons.description_outlined;
                  return Material(
                    color: context.bgCard,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: route == null ? null : () => context.push(route),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: context.borderSubtle),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: AppColors.brandOrange.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(icon, size: 18, color: AppColors.brandOrange),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                doc.title,
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: context.textPrimary,
                                ),
                              ),
                            ),
                            Icon(Icons.chevron_right, size: 18, color: context.textDim),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}
