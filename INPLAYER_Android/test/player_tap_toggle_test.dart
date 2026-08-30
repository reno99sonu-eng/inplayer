import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/features/watch/presentation/widgets/player_chrome.dart';

void main() {
  group('PlayerChrome tap toggle logic', () {
    test('center taps and paused-state taps immediately toggle play state', () {
      expect(shouldTogglePlayOnTap(null, false), isTrue);
      expect(shouldTogglePlayOnTap(null, true), isTrue);
      expect(shouldTogglePlayOnTap('left', true), isFalse);
      expect(shouldTogglePlayOnTap('right', false), isTrue);
    });
  });
}
