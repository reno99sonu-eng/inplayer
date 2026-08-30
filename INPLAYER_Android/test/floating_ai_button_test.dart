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

    expect(find.text('InPlayer AI Studio'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.byTooltip('Close InPlayer AI'));
    await tester.pump(); // Trigger the pop
    await tester.pump(const Duration(milliseconds: 400)); // Wait for transition
    await tester.pump(); // Complete removal

    expect(find.text('InPlayer AI Studio'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
