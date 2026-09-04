import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/features/home/presentation/widgets/floating_ai_button.dart';

void main() {
  testWidgets('opens and closes the bounded InPlayer AI dialog', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(body: Stack(children: [FloatingAIButton()])),
        ),
      ),
    );

    await tester.tap(find.byType(InkWell));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Assert on the tooltip rather than only the header text: the title is
    // copy and has already been renamed once (it was 'InPlayer AI Studio'
    // before the panel was split into compose/results), which silently
    // broke this test. The tooltip is a stable handle on the same dialog.
    expect(find.byTooltip('Close InPlayer AI'), findsOneWidget);
    expect(find.text('InPlayer AI'), findsOneWidget);
    // The compose panel's primary action must be built — this is the panel
    // whose whole purpose is fitting without a scroll.
    expect(find.text('Generate ideas'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.byTooltip('Close InPlayer AI'));
    await tester.pump(); // Trigger the pop
    await tester.pump(const Duration(milliseconds: 400)); // Wait for transition
    await tester.pump(); // Complete removal

    expect(find.text('InPlayer AI'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
