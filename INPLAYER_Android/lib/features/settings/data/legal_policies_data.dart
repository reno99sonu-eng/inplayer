// AUTHORITATIVE LEGAL POLICY DATA REPOSITORY FOR INPLAYER ANDROID
// Effective Date: September 5, 2026 • Version: 2026-09-05
// Master Set: 11 Authoritative Platform Policies

import 'policies/advertising_sponsorship_policy.dart';
import 'policies/chat_messaging_policy.dart';
import 'policies/child_safety_policy.dart';
import 'policies/community_guidelines_policy.dart';
import 'policies/copyright_policy.dart';
import 'policies/creator_monetization_policy.dart';
import 'policies/mart_seller_policy.dart';
import 'policies/privacy_policy.dart';
import 'policies/report_grievance_policy.dart';
import 'policies/strikes_appeals_policy.dart';
import 'policies/terms_policy.dart';

export 'policies/advertising_sponsorship_policy.dart';
export 'policies/chat_messaging_policy.dart';
export 'policies/child_safety_policy.dart';
export 'policies/community_guidelines_policy.dart';
export 'policies/copyright_policy.dart';
export 'policies/creator_monetization_policy.dart';
export 'policies/mart_seller_policy.dart';
export 'policies/privacy_policy.dart';
export 'policies/report_grievance_policy.dart';
export 'policies/strikes_appeals_policy.dart';
export 'policies/terms_policy.dart';

class LegalPolicySection {
  final String id;
  final String title;
  final String content;

  const LegalPolicySection({
    required this.id,
    required this.title,
    required this.content,
  });
}

class LegalPolicyDoc {
  final String id;
  final String title;
  final String effectiveDate;
  final String version;
  final String externalUrl;
  final String preamble;
  final List<LegalPolicySection> sections;

  const LegalPolicyDoc({
    required this.id,
    required this.title,
    required this.effectiveDate,
    required this.version,
    required this.externalUrl,
    required this.preamble,
    required this.sections,
  });
}

class LegalPolicyRepository {
  static const String effectiveDate = 'September 5, 2026';
  static const String version = '2026-09-05';

  static final Map<String, LegalPolicyDoc> _docs = {
    'terms': termsPolicy,
    'privacy': privacyPolicy,
    'copyright': copyrightPolicy,
    'child-safety': childSafetyPolicy,
    'community-guidelines': communityGuidelinesPolicy,
    'monetization': creatorMonetizationPolicy,
    'creator-monetization': creatorMonetizationPolicy,
    'chat-messaging': chatMessagingPolicy,
    'strikes-appeals': strikesAppealsPolicy,
    'report-grievance': reportGrievancePolicy,
    'advertising-sponsorship': advertisingSponsorshipPolicy,
    'mart-seller': martSellerPolicy,
    'vendor-terms': martSellerPolicy,
  };

  /// Returns the matching authoritative policy document by ID or normalized title.
  static LegalPolicyDoc? getPolicy(String query) {
    final normalized = query.trim().toLowerCase();

    if (_docs.containsKey(normalized)) {
      return _docs[normalized];
    }

    if (normalized.contains('term')) return termsPolicy;
    if (normalized.contains('privac')) return privacyPolicy;
    if (normalized.contains('copyright') || normalized.contains('intellectual')) return copyrightPolicy;
    if (normalized.contains('child')) return childSafetyPolicy;
    if (normalized.contains('communit') || normalized.contains('guideline')) return communityGuidelinesPolicy;
    if (normalized.contains('monetiz') || normalized.contains('creator earn')) return creatorMonetizationPolicy;
    if (normalized.contains('chat') || normalized.contains('messag')) return chatMessagingPolicy;
    if (normalized.contains('strike') || normalized.contains('appeal') || normalized.contains('suspens')) return strikesAppealsPolicy;
    if (normalized.contains('report') || normalized.contains('grievance') || normalized.contains('complaint')) return reportGrievancePolicy;
    if (normalized.contains('advertis') || normalized.contains('sponsor')) return advertisingSponsorshipPolicy;
    if (normalized.contains('mart') || normalized.contains('seller') || normalized.contains('shop') || normalized.contains('vendor')) return martSellerPolicy;

    return null;
  }

  /// Returns all 11 authoritative master policy documents in canonical order.
  static List<LegalPolicyDoc> getAllPolicies() {
    return [
      termsPolicy,
      privacyPolicy,
      copyrightPolicy,
      childSafetyPolicy,
      communityGuidelinesPolicy,
      creatorMonetizationPolicy,
      chatMessagingPolicy,
      strikesAppealsPolicy,
      reportGrievancePolicy,
      advertisingSponsorshipPolicy,
      martSellerPolicy,
    ];
  }
}
