import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/pattern_background.dart';
import 'policies_content.dart';

/// The single "InPlayer Policies" screen — replaces the three separate
/// routes (/settings/terms, /settings/privacy-policy,
/// /settings/vendor-terms) that used to each open their own AppLegalPage
/// with a short, independently-drifting paraphrase of the real policy.
/// Mirrors the website's /policies hub (same three documents, same tab
/// order), sourced from policies_content.dart — one place, not three.
class AppPoliciesPage extends StatefulWidget {
  /// 0 = Privacy, 1 = Terms, 2 = Vendor Terms — lets a caller (e.g. a
  /// HamMart-vendor-onboarding-adjacent screen) open straight to the
  /// relevant tab instead of always defaulting to Privacy.
  final int initialTab;

  const AppPoliciesPage({super.key, this.initialTab = 0});

  @override
  State<AppPoliciesPage> createState() => _AppPoliciesPageState();
}

class _AppPoliciesPageState extends State<AppPoliciesPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  static const _docs = [privacyPolicyDoc, termsOfServiceDoc, vendorTermsDoc];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: _docs.length,
      vsync: this,
      initialIndex: widget.initialTab.clamp(0, _docs.length - 1),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
          bottom: TabBar(
            controller: _tabController,
            isScrollable: true,
            labelColor: AppColors.brandOrange,
            unselectedLabelColor: context.textDim,
            indicatorColor: AppColors.brandOrange,
            labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            tabs: const [
              Tab(text: 'Privacy'),
              Tab(text: 'Terms'),
              Tab(text: 'Vendor Terms'),
            ],
          ),
        ),
        body: TabBarView(
          controller: _tabController,
          children: _docs.map((doc) => _PolicyDocView(doc: doc)).toList(),
        ),
      ),
    );
  }
}

class _PolicyDocView extends StatelessWidget {
  final PolicyDocData doc;

  const _PolicyDocView({required this.doc});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Container(
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
              doc.title,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: context.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Last updated: ${doc.lastUpdated}',
              style: TextStyle(fontSize: 12, color: context.textDim),
            ),
            if (doc.intro.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                doc.intro,
                style: TextStyle(fontSize: 14, color: context.textPrimary, height: 1.6),
              ),
            ],
            for (final section in doc.sections) ...[
              const SizedBox(height: 20),
              Text(
                section.title,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: context.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                section.body,
                style: TextStyle(fontSize: 14, color: context.textPrimary, height: 1.6),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
