import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/core/utils/responsive.dart';

void main() {
  group('Responsive Breakpoints & Calculations', () {
    testWidgets('Phone Portrait (390x844) preserves 1 column & phone flags', (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      late bool isPhone;
      late bool isTablet;
      late bool isLargeScreen;
      late int columns;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              isPhone = context.isPhone;
              isTablet = context.isTablet;
              isLargeScreen = context.isLargeScreen;
              columns = context.responsiveVideoColumns;
              return const SizedBox();
            },
          ),
        ),
      );

      expect(isPhone, isTrue);
      expect(isTablet, isFalse);
      expect(isLargeScreen, isFalse);
      expect(columns, equals(1));
    });

    testWidgets('Phone Landscape (844x390) preserves shortestSide < 600', (tester) async {
      tester.view.physicalSize = const Size(844, 390);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      late double shortestSide;
      late Orientation orientation;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              final media = MediaQuery.of(context);
              shortestSide = media.size.shortestSide;
              orientation = media.orientation;
              return const SizedBox();
            },
          ),
        ),
      );

      expect(shortestSide, equals(390));
      expect(shortestSide < 600, isTrue);
      expect(orientation, equals(Orientation.landscape));
    });

    testWidgets('Tablet Portrait (800x1280) scales to 2 columns and shortestSide >= 600', (tester) async {
      tester.view.physicalSize = const Size(800, 1280);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      late bool isTablet;
      late double shortestSide;
      late int columns;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              final media = MediaQuery.of(context);
              isTablet = context.isTablet;
              shortestSide = media.size.shortestSide;
              columns = context.responsiveVideoColumns;
              return const SizedBox();
            },
          ),
        ),
      );

      expect(isTablet, isTrue);
      expect(shortestSide, equals(800));
      expect(shortestSide >= 600, isTrue);
      expect(columns, equals(2));
    });

    testWidgets('Tablet Landscape 10-inch (1024x768) scales to 3 columns and triggers 2-pane condition', (tester) async {
      tester.view.physicalSize = const Size(1024, 768);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      late bool isLargeScreen;
      late double shortestSide;
      late Orientation orientation;
      late int columns;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              final media = MediaQuery.of(context);
              isLargeScreen = context.isLargeScreen;
              shortestSide = media.size.shortestSide;
              orientation = media.orientation;
              columns = context.responsiveVideoColumns;
              return const SizedBox();
            },
          ),
        ),
      );

      expect(isLargeScreen, isTrue);
      expect(shortestSide, equals(768));
      expect(shortestSide >= 600, isTrue);
      expect(orientation, equals(Orientation.landscape));
      expect(columns, equals(3));
    });

    testWidgets('Large Tablet / Desktop (1280x800) scales to 4 columns and triggers 2-pane condition', (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      late bool isLargeScreen;
      late double shortestSide;
      late Orientation orientation;
      late int columns;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              final media = MediaQuery.of(context);
              isLargeScreen = context.isLargeScreen;
              shortestSide = media.size.shortestSide;
              orientation = media.orientation;
              columns = context.responsiveVideoColumns;
              return const SizedBox();
            },
          ),
        ),
      );

      expect(isLargeScreen, isTrue);
      expect(shortestSide, equals(800));
      expect(shortestSide >= 600, isTrue);
      expect(orientation, equals(Orientation.landscape));
      expect(columns, equals(4));
    });

    testWidgets('Full HD Display (1920x1080) scales to 4 columns', (tester) async {
      tester.view.physicalSize = const Size(1920, 1080);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      late int columns;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              columns = context.responsiveVideoColumns;
              return const SizedBox();
            },
          ),
        ),
      );

      expect(columns, equals(4));
    });
  });

  group('ResponsiveContent Clamping', () {
    testWidgets('Unconstrained on phone (<600dp), clamped on large screen', (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1.0;

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ResponsiveContent(
              maxWidth: 720,
              child: SizedBox(
                key: Key('test_child'),
                width: double.infinity,
                height: 100,
              ),
            ),
          ),
        ),
      );

      final phoneRenderBox = tester.renderObject<RenderBox>(find.byKey(const Key('test_child')));
      expect(phoneRenderBox.size.width, equals(390));

      tester.view.physicalSize = const Size(1280, 800);
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ResponsiveContent(
              maxWidth: 720,
              child: SizedBox(
                key: Key('test_child_2'),
                width: double.infinity,
                height: 100,
              ),
            ),
          ),
        ),
      );

      final largeRenderBox = tester.renderObject<RenderBox>(find.byKey(const Key('test_child_2')));
      expect(largeRenderBox.size.width, equals(720));

      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
  });
}
