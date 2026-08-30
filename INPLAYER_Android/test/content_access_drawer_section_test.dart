import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/features/home/presentation/widgets/content_access_drawer_section.dart';
import 'package:inplayer_android/services/content_access_service.dart';

class _FakeContentAccessService extends ContentAccessService {
  int setPasskeyCalls = 0;
  int setModeCalls = 0;
  String? savedPasskey;
  String? unlockPasskey;
  AudienceMode? requestedMode;

  @override
  Future<ContentAccessState?> getState() async {
    return const ContentAccessState(
      mode: AudienceMode.family,
      hasPasskey: false,
    );
  }

  @override
  Future<ContentAccessResult> setPasskey(
    String passkey, {
    String? currentPasskey,
  }) async {
    setPasskeyCalls++;
    savedPasskey = passkey;
    return const ContentAccessResult(success: true);
  }

  @override
  Future<ContentAccessResult> setMode(
    AudienceMode mode, {
    String? passkey,
  }) async {
    setModeCalls++;
    requestedMode = mode;
    unlockPasskey = passkey;
    return const ContentAccessResult(success: true);
  }
}

Widget _drawerHarness(_FakeContentAccessService service) {
  return ProviderScope(
    overrides: [
      contentAccessServiceProvider.overrideWithValue(service),
      contentAccessSignedInProvider.overrideWithValue(true),
    ],
    child: MaterialApp(
      home: Scaffold(
        drawer: const Drawer(
          child: SafeArea(child: ContentAccessDrawerSection()),
        ),
        body: Builder(
          builder: (context) => Center(
            child: ElevatedButton(
              key: const ValueKey<String>('open-drawer'),
              onPressed: () => Scaffold.of(context).openDrawer(),
              child: const Text('Open menu'),
            ),
          ),
        ),
      ),
    ),
  );
}

Future<void> _openAdultPasskeySheet(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey<String>('open-drawer')));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));

  await tester.tap(find.byKey(ContentAccessDrawerSection.adultToggleKey));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 200));

  expect(find.byKey(ContentAccessDrawerSection.cancelKey), findsOneWidget);
}

void main() {
  testWidgets('cancelling 18+ leaves the drawer and server state untouched', (
    tester,
  ) async {
    final service = _FakeContentAccessService();
    await tester.pumpWidget(_drawerHarness(service));

    await _openAdultPasskeySheet(tester);
    await tester.tap(find.byKey(ContentAccessDrawerSection.cancelKey));
    await tester.pump();

    expect(service.setPasskeyCalls, 0);
    expect(service.setModeCalls, 0);
    expect(tester.takeException(), isNull);

    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump();

    expect(service.setPasskeyCalls, 0);
    expect(service.setModeCalls, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets('saves and unlocks only after the passkey route is disposed', (
    tester,
  ) async {
    final service = _FakeContentAccessService();
    await tester.pumpWidget(_drawerHarness(service));

    await _openAdultPasskeySheet(tester);
    await tester.enterText(
      find.byKey(ContentAccessDrawerSection.passkeyFieldKey),
      '246810',
    );
    await tester.enterText(
      find.byKey(ContentAccessDrawerSection.confirmPasskeyFieldKey),
      '246810',
    );
    await tester.tap(find.byKey(ContentAccessDrawerSection.continueKey));
    await tester.pump();

    // `Navigator.pop` has happened, but RawDialogRoute's reverse transition
    // is still active. The parent must not call the API at this point.
    expect(service.setPasskeyCalls, 0);
    expect(service.setModeCalls, 0);
    expect(tester.takeException(), isNull);

    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump();

    expect(service.setPasskeyCalls, 1);
    expect(service.savedPasskey, '246810');
    expect(service.setModeCalls, 1);
    expect(service.requestedMode, AudienceMode.all);
    expect(service.unlockPasskey, '246810');
    expect(tester.takeException(), isNull);
  });
}
