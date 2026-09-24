import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../data/legal_policies_data.dart' show LegalPolicyDoc, LegalPolicyRepository;

/// The single "InPlayer Policies" screen — every one of InPlayer's 11 legal
/// documents lives on THIS one page now, each expandable in place, rather
/// than navigating out to 11 separate full-screen routes. Replaces the
/// earlier version of this page, which was itself already a consolidation
/// (11 Settings rows -> 1 menu) but was still just a list of links to
/// AppLegalPage — one tap away from a whole new screen per policy, which
/// read as "still a list" rather than "one screen."
class PoliciesIndexPage extends StatelessWidget {
  const PoliciesIndexPage({super.key});

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
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Effective Date & Version — shared by every policy below,
                  // shown once instead of 11 times.
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.amber.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.verified_user_outlined, size: 18, color: Colors.amber),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Effective: ${LegalPolicyRepository.effectiveDate} • Version ${LegalPolicyRepository.version}',
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
                          style: TextStyle(fontSize: 11, color: context.textSecondary, height: 1.4),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Support: support@inplayer.in • Platform: www.inplayer.in',
                          style: TextStyle(fontSize: 11, color: context.textPrimary, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  for (final doc in policies)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _PolicyAccordionItem(
                        doc: doc,
                        icon: _iconByPolicyId[doc.id] ?? Icons.description_outlined,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PolicyAccordionItem extends StatefulWidget {
  final LegalPolicyDoc doc;
  final IconData icon;

  const _PolicyAccordionItem({required this.doc, required this.icon});

  @override
  State<_PolicyAccordionItem> createState() => _PolicyAccordionItemState();
}

class _PolicyAccordionItemState extends State<_PolicyAccordionItem> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final doc = widget.doc;
    return Material(
      color: context.bgCard,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(border: Border.all(color: context.borderSubtle)),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.brandOrange.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(widget.icon, size: 18, color: AppColors.brandOrange),
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
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(Icons.expand_more, size: 20, color: context.textDim),
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox(width: double.infinity),
            secondChild: Container(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 16),
              decoration: BoxDecoration(
                border: Border(
                  left: BorderSide(color: context.borderSubtle),
                  right: BorderSide(color: context.borderSubtle),
                  bottom: BorderSide(color: context.borderSubtle),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (doc.preamble.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Text(
                      doc.preamble,
                      style: TextStyle(fontSize: 13, color: context.textPrimary, height: 1.6),
                    ),
                  ],
                  for (final section in doc.sections) ...[
                    const SizedBox(height: 16),
                    Text(
                      section.title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppColors.brandOrange,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _formattedBody(context, section.content),
                  ],
                  if (doc.externalUrl.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final uri = Uri.tryParse(doc.externalUrl);
                        if (uri != null) {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        }
                      },
                      icon: const Icon(Icons.open_in_new, size: 16, color: Colors.amber),
                      label: const Text(
                        'View on website',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Colors.amber, width: 1.5),
                        backgroundColor: Colors.black45,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            crossFadeState: _expanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 200),
          ),
        ],
      ),
    );
  }

  Widget _formattedBody(BuildContext context, String text) {
    final blocks = text.split('\n\n');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (int i = 0; i < blocks.length; i++) ...[
          if (blocks[i].startsWith('### '))
            Padding(
              padding: const EdgeInsets.only(top: 6, bottom: 4),
              child: Text(
                blocks[i].replaceFirst('### ', ''),
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: context.textPrimary),
              ),
            )
          else
            Text(
              blocks[i],
              style: TextStyle(
                fontSize: 12.5,
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
