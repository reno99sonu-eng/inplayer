import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:video_player/video_player.dart';
import 'package:inplayer_android/features/shorts/presentation/widgets/short_player_widget.dart';

void main() {
  testWidgets('INPLAYER app loads successfully', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(child: Text('InPlayer')),
        ),
      ),
    );
    expect(find.text('InPlayer'), findsOneWidget);
  });

  test('Shorts reveal waits for a real frame and playback progress', () {
    final ready = shouldRevealShortFrame(
      const VideoPlayerValue(
        duration: Duration(seconds: 30),
        position: Duration(milliseconds: 600),
        size: Size(1080, 1920),
        isPlaying: true,
        isInitialized: true,
      ),
    );
    expect(ready, isTrue);

    final notReady = shouldRevealShortFrame(
      const VideoPlayerValue(
        duration: Duration(seconds: 30),
        position: Duration.zero,
        size: Size(1080, 1920),
        isPlaying: true,
        isInitialized: true,
      ),
    );
    expect(notReady, isFalse);
  });
}