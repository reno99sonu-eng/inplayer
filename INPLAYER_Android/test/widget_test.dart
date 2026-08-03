import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:inplayer_android/main.dart';

void main() {
  testWidgets('INPLAYER app loads successfully', (WidgetTester tester) async {
    await tester.pumpWidget(const InplayerApp());

    expect(find.text('INPLAYER'), findsOneWidget);
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}