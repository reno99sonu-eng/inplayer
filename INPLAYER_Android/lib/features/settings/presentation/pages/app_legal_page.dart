import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../data/legal_policies_data.dart';

/// Reusable in-app legal document page for displaying full platform policies
/// with complete section hierarchy, effective date, versioning, and company info.
class AppLegalPage extends StatelessWidget {
  final String title;
  final String content;
  final String? externalUrl;
  final String? effectiveDate;
  final String? policyId;

  const AppLegalPage({
    super.key,
    required this.title,
    this.content = '',
    this.externalUrl,
    this.effectiveDate,
    this.policyId,
  });

  @override
  Widget build(BuildContext context) {
    // Resolve full authoritative document if available
    final doc = policyId != null
        ? LegalPolicyRepository.getPolicy(policyId!)
        : (content.isEmpty ? LegalPolicyRepository.getPolicy(title) : null);

    final displayTitle = doc?.title ?? title;
    final displayEffectiveDate =
        effectiveDate ?? doc?.effectiveDate ?? 'September 5, 2026';
    final displayVersion = doc?.version ?? '2026-09-05';
    final displayUrl = externalUrl ?? doc?.externalUrl;

    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          title: Text(
            displayTitle,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: context.textPrimary,
              letterSpacing: -0.5,
              fontSize: 18,
            ),
          ),
        ),
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 820),
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Effective Date & Version Badge
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.amber.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.verified_user_outlined,
                            size: 18,
                            color: Colors.amber,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Effective: $displayEffectiveDate • Version $displayVersion',
                              style: const TextStyle(
                                color: Colors.amber,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    if (doc != null) ...[
                      // Platform Operator Card
                      Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: context.bgCard,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: context.borderSubtle),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'HOMOX PRIME PRIVATE LIMITED',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                                letterSpacing: 0.5,
                                color: AppColors.brandOrange,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris,\nGorwa, Vadodara, Gujarat – 390016, India\nGSTIN: 24AAICH1282J1ZK',
                              style: TextStyle(
                                fontSize: 11,
                                color: context.textSecondary,
                                height: 1.4,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Support: support@inplayer.in • Platform: www.inplayer.in',
                              style: TextStyle(
                                fontSize: 11,
                                color: context.textPrimary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Preamble
                      if (doc.preamble.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.only(bottom: 20),
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: context.bgCard,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: context.borderSubtle),
                          ),
                          child: Text(
                            doc.preamble,
                            style: TextStyle(
                              fontSize: 13.5,
                              color: context.textPrimary,
                              height: 1.6,
                            ),
                          ),
                        ),

                      // Complete Sections
                      for (final section in doc.sections)
                        Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: context.bgCard,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: context.borderSubtle),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                section.title,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.brandOrange,
                                  letterSpacing: -0.2,
                                ),
                              ),
                              const SizedBox(height: 10),
                              _buildFormattedBody(context, section.content),
                            ],
                          ),
                        ),
                    ] else ...[
                      // Fallback content for custom text or unregistered policies
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: context.bgCard,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: context.borderSubtle),
                        ),
                        child: Text(
                          content,
                          style: TextStyle(
                            fontSize: 14,
                            color: context.textPrimary,
                            height: 1.6,
                          ),
                        ),
                      ),
                    ],

                    // View Full Policy on Website Button (Optional secondary action)
                    if (displayUrl != null) ...[
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: () async {
                          final uri = Uri.tryParse(displayUrl);
                          if (uri != null) {
                            await launchUrl(
                              uri,
                              mode: LaunchMode.externalApplication,
                            );
                          }
                        },
                        icon: const Icon(
                          Icons.open_in_new,
                          size: 16,
                          color: Colors.amber,
                        ),
                        label: const Text(
                          'View Full Policy on Website',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: const BorderSide(color: Colors.amber, width: 1.5),
                          backgroundColor: Colors.black45,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFormattedBody(BuildContext context, String text) {
    final blocks = text.split('\n\n');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (int i = 0; i < blocks.length; i++) ...[
          if (blocks[i].startsWith('### '))
            Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 4),
              child: Text(
                blocks[i].replaceFirst('### ', ''),
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: context.textPrimary,
                ),
              ),
            )
          else
            Text(
              blocks[i],
              style: TextStyle(
                fontSize: 13,
                color: context.textPrimary.withValues(alpha: 0.9),
                height: 1.55,
              ),
            ),
          if (i < blocks.length - 1) const SizedBox(height: 8),
        ],
      ],
    );
  }
}
