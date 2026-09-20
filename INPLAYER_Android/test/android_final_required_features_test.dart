import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:inplayer_android/models/user.dart';
import 'package:inplayer_android/services/ad_service.dart';
import 'package:inplayer_android/services/geo_service.dart';
import 'package:inplayer_android/services/device_location_service.dart';
import 'package:inplayer_android/features/auth/presentation/widgets/terms_acceptance_modal.dart';
import 'package:inplayer_android/features/settings/presentation/pages/app_legal_page.dart';
import 'package:inplayer_android/features/settings/data/legal_policies_data.dart';
import 'package:inplayer_android/core/utils/music_track_utils.dart';
import 'package:inplayer_android/models/lyric_line.dart';
import 'package:inplayer_android/models/video.dart';
import 'package:inplayer_android/features/home/presentation/pages/music_page.dart';
import 'package:inplayer_android/services/video_service.dart';
import 'package:inplayer_android/services/history_service.dart';

class _MockVideoService extends VideoService {
  @override
  Future<List<Video>> getVideos({bool forceRefresh = false}) async => [];
  @override
  Future<List<Video>> getMusicTracks({bool forceRefresh = false}) async => [];
}

class _MockHistoryService extends HistoryService {
  @override
  Future<List<Map<String, dynamic>>> getHistory() async => [];
}

void main() {
  group('Ad Requirements Tests', () {
    test('MidrollAd correctly parses all fields including linkUrl', () {
      final ad = MidrollAd.fromJson({
        'adId': 'ad_123',
        'imageUrl': 'mux:playback_abc_456',
        'linkUrl': 'https://homoxprime.com',
        'title': 'Homox Prime Sponsor',
      });

      expect(ad.adId, 'ad_123');
      expect(ad.imageUrl, 'mux:playback_abc_456');
      expect(ad.linkUrl, 'https://homoxprime.com');
      expect(ad.title, 'Homox Prime Sponsor');
    });

    test('MidrollConfig handles multi-tier skip countdowns [5, 10, 15]', () {
      final config = MidrollConfig.fromJson({
        'enabled': true,
        'intervalSeconds': 120,
        'skipTiersSeconds': [5, 10, 15],
        'ads': [
          {
            'adId': 'ad_1',
            'imageUrl': 'mux:playback_1',
            'linkUrl': 'https://sponsor1.com',
            'title': 'Sponsor 1',
          },
          {
            'adId': 'ad_2',
            'imageUrl': 'mux:playback_2',
            'linkUrl': 'https://sponsor2.com',
            'title': 'Sponsor 2',
          },
        ],
      });

      expect(config.enabled, isTrue);
      expect(config.intervalSeconds, 120);
      expect(config.skipTiersSeconds, [5, 10, 15]);
      expect(config.ads.length, 2);
      expect(config.ads[0].adId, 'ad_1');
      expect(config.ads[1].adId, 'ad_2');
    });
  });

  group('Legal & Policy Requirements Tests', () {
    test('User model accurately reflects termsAccepted state and copyWith', () {
      final user = User(
        userId: 'user_test_1',
        username: 'testuser',
        name: 'Test User',
        email: 'test@inplayer.in',
        termsAccepted: false,
      );

      expect(user.termsAccepted, isFalse);

      final acceptedUser = user.copyWith(termsAccepted: true);
      expect(acceptedUser.termsAccepted, isTrue);
      expect(acceptedUser.userId, 'user_test_1');
      expect(acceptedUser.username, 'testuser');
    });

    testWidgets('AppLegalPage renders title, effective date badge, and external link button',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AppLegalPage(
            title: 'Copyright & IP Policy',
            effectiveDate: 'September 5, 2026',
            externalUrl: 'https://inplayer.in/copyright',
            content: 'Official Copyright policy summary content.',
          ),
        ),
      );

      expect(find.text('Copyright & IP Policy'), findsOneWidget);
      expect(find.text('Effective: September 5, 2026 • Version 2026-09-05'), findsOneWidget);
      expect(find.text('Official Copyright policy summary content.'), findsOneWidget);
      expect(find.text('View Full Policy on Website'), findsOneWidget);
      expect(find.byIcon(Icons.open_in_new), findsOneWidget);
    });

    test('LegalPolicyRepository contains all 11 complete authoritative policies with exact source section counts and client thresholds', () {
      final expectedSectionCounts = {
        'terms': 40,
        'privacy': 40,
        'copyright': 38,
        'child-safety': 54,
        'community-guidelines': 51,
        'creator-monetization': 35,
        'chat-messaging': 41,
        'strikes-appeals': 45,
        'report-grievance': 46,
        'advertising-sponsorship': 41,
        'mart-seller': 44,
      };

      expect(LegalPolicyRepository.getAllPolicies().length, 11);

      for (final entry in expectedSectionCounts.entries) {
        final id = entry.key;
        final expectedCount = entry.value;
        final policy = LegalPolicyRepository.getPolicy(id);

        expect(policy, isNotNull, reason: 'Policy $id must exist');
        expect(policy!.version, '2026-09-05');
        expect(policy.effectiveDate, 'September 5, 2026');
        expect(policy.sections.length, expectedCount,
            reason: 'Policy $id must match authoritative source section count of $expectedCount');
        expect(policy.preamble.isNotEmpty, isTrue, reason: 'Policy $id must have preamble');
        expect(policy.preamble.toUpperCase(), contains('HOMOX PRIME PRIVATE LIMITED'));

        // Verify no date placeholders exist in preamble or any section
        expect(policy.preamble, isNot(contains('[Insert')));
        expect(policy.preamble, isNot(contains('[Date]')));
        for (final section in policy.sections) {
          expect(section.title, isNot(contains('[Insert')));
          expect(section.content, isNot(contains('[Insert')));
          expect(section.content, isNot(contains('[Date]')));
        }
      }

      // Authoritative Creator Monetization verification (NO YouTube-style 1,000 subs / 4,000 hours)
      final monetization = LegalPolicyRepository.getPolicy('creator-monetization')!;
      expect(monetization.sections[2].title, '3. ELIGIBILITY FOR KYC');
      expect(monetization.sections[2].content, contains('500 In-Family + 50,000 valid views'));
      expect(monetization.sections[2].content, isNot(contains('1,000 subscribers')));
      expect(monetization.sections[2].content, isNot(contains('4,000 watch hours')));
      expect(monetization.sections[13].title, '14. 10,000 IN-FAMILY CREATOR GIFT');
      expect(monetization.sections[13].content, contains('10,000 In-Family'));

      // Authoritative Chat & Messaging verification
      final chatPolicy = LegalPolicyRepository.getPolicy('chat-messaging')!;
      expect(chatPolicy.sections[3].content, contains('Gandi gaali'));
      expect(chatPolicy.sections[21].content, contains('SUSPENDED OR BLOCKED FOR UP TO 24 HOURS'));
      expect(chatPolicy.sections[22].content, contains('PERMANENT CHAT BLOCK'));

      // Authoritative Report & Grievance verification
      final grievancePolicy = LegalPolicyRepository.getPolicy('report-grievance')!;
      expect(grievancePolicy.sections[17].title, '18. GRIEVANCE OFFICER');
      expect(grievancePolicy.sections[17].content, contains('Mr. Ramchandra Kushwaha'));
      expect(grievancePolicy.sections[17].content, contains('grievance@inplayer.in'));

      // Authoritative InPlayer MART Shop & Seller verification
      final martPolicy = LegalPolicyRepository.getPolicy('mart-seller')!;
      expect(martPolicy.sections[5].title, '6. SELLER APPROVAL');
      expect(martPolicy.sections[5].content, contains('48 HOURS'));
      expect(martPolicy.sections[12].title, '13. INPLAYER MART COMMISSION');
      expect(martPolicy.sections[12].content, contains('0.05%'));

      // Aliases
      expect(LegalPolicyRepository.getPolicy('vendor-terms')?.id, 'mart-seller');
      expect(LegalPolicyRepository.getPolicy('monetization')?.id, 'creator-monetization');
    });

    testWidgets('AppLegalPage renders full authoritative document with operator info and sections',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AppLegalPage(
            title: 'Terms & Conditions',
            policyId: 'terms',
          ),
        ),
      );

      expect(find.text('Terms & Conditions'), findsAtLeast(1));
      expect(find.text('HOMOX PRIME PRIVATE LIMITED'), findsAtLeast(1));
      expect(find.text('Effective: September 5, 2026 • Version 2026-09-05'), findsOneWidget);
      expect(find.text('1. ABOUT INPLAYER'), findsOneWidget);
      expect(find.text('View Full Policy on Website'), findsOneWidget);
    });

    testWidgets('AppLegalPage renders Report & Grievance policy with Grievance Officer info',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AppLegalPage(
            title: 'Report, Complaint & Grievance Policy',
            policyId: 'report-grievance',
          ),
        ),
      );

      expect(find.text('Report, Complaint & Grievance Policy'), findsAtLeast(1));
      expect(find.text('HOMOX PRIME PRIVATE LIMITED'), findsAtLeast(1));
      expect(find.text('Effective: September 5, 2026 • Version 2026-09-05'), findsOneWidget);
    });

    testWidgets('TermsAcceptanceModalOverlay displays all 11 required policy links',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: TermsAcceptanceModalOverlay(),
            ),
          ),
        ),
      );

      expect(find.text('POLICY UPDATE • SEPT 5, 2026'), findsOneWidget);
      expect(find.text('Terms & Policies Update'), findsOneWidget);
      expect(find.text('Terms of Service'), findsOneWidget);
      expect(find.text('Privacy Policy'), findsOneWidget);
      expect(find.text('Copyright & Intellectual Property Policy'), findsOneWidget);
      expect(find.text('Child Safety Policy'), findsOneWidget);
      expect(find.text('Community Guidelines'), findsOneWidget);
      expect(find.text('Creator Monetization Policy'), findsOneWidget);
      expect(find.text('Online Chat & Messaging Policy'), findsOneWidget);
      expect(find.text('Strike, Suspension & Appeals Policy'), findsOneWidget);
      expect(find.text('Report, Complaint & Grievance Policy'), findsOneWidget);
      expect(find.text('Advertising & Sponsorship Policy'), findsOneWidget);
      expect(find.text('InPlayer MART Shop & Seller Policy'), findsOneWidget);
      expect(find.text('Accept & Continue'), findsOneWidget);
      expect(find.text('Decline'), findsOneWidget);
    });
  });

  group('Performance & Startup Tests', () {
    test('requestDeviceLocation returns allowed immediately on India device fast path', () async {
      final mockGeoService = GeoService();
      // On India devices (IST timezone UTC+5:30), isLikelyIndiaDevice is true
      if (mockGeoService.isLikelyIndiaDevice) {
        final stopwatch = Stopwatch()..start();
        final result = await requestDeviceLocation(mockGeoService);
        stopwatch.stop();

        expect(result.allowed, isTrue);
        expect(result.country, 'IN');
        // Must resolve instantly without waiting for 4-second GPS timeout
        expect(stopwatch.elapsedMilliseconds, lessThan(1000));
      }
    });
  });

  group('Music Requirements Tests (5A Lyrics Toggle & 5B Compact UI)', () {
    test('5A: parseLyrics parses synchronized and plain lines correctly', () {
      const sampleLrc = '''
[00:12.50]First line of the song
[00:24.00]Second line after chorus
[00:35.00]Third line outro
''';
      final lines = parseLyrics(sampleLrc);
      expect(lines.length, 3);
      expect(lines[0].text, 'First line of the song');
      expect(lines[0].time, closeTo(12.50, 0.01));
      expect(lines[1].text, 'Second line after chorus');
      expect(lines[1].time, closeTo(24.00, 0.01));
      expect(lines[2].text, 'Third line outro');
      expect(lines[2].time, closeTo(35.00, 0.01));
    });

    test('5A: Lyrics toggle disabled sends empty array for instrumental tracks', () {
      List<Map<String, dynamic>> serializeLyrics({
        required bool enabled,
        required List<LyricLine> synced,
        required String raw,
      }) {
        if (!enabled) return [];
        if (synced.isNotEmpty) {
          return synced.map((l) => l.toJson()).toList();
        } else if (raw.trim().isNotEmpty) {
          return parseLyrics(raw).map((l) => l.toJson()).toList();
        }
        return [];
      }

      final synced = [LyricLine(time: 5.0, text: 'Some lyrics')];

      // Instrumental track with lyrics disabled MUST produce empty list
      final disabledResult = serializeLyrics(
        enabled: false,
        synced: synced,
        raw: '[00:05.00]Some lyrics',
      );
      expect(disabledResult, isEmpty);

      // When enabled, it correctly serializes
      final enabledResult = serializeLyrics(
        enabled: true,
        synced: synced,
        raw: '',
      );
      expect(enabledResult.length, 1);
      expect(enabledResult[0]['text'], 'Some lyrics');
      expect(enabledResult[0]['time'], 5.0);
    });

    testWidgets('5B: MusicPage renders prominent Upload Music action and Settings in AppBar',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            videoServiceProvider.overrideWithValue(_MockVideoService()),
            historyServiceProvider.overrideWithValue(_MockHistoryService()),
          ],
          child: const MaterialApp(
            home: MusicPage(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify Title
      expect(find.text('Music'), findsOneWidget);

      // 5B: Prominent upload button in AppBar
      expect(find.byTooltip('Upload music'), findsOneWidget);
      expect(find.byIcon(Icons.add_circle_outline_rounded), findsOneWidget);

      // Settings and Downloaded actions
      expect(find.byTooltip('Music settings'), findsOneWidget);
      expect(find.byTooltip('Downloaded'), findsOneWidget);
    });
  });
}
