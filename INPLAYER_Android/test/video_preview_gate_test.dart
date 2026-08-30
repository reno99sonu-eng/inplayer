import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/core/utils/video_preview_gate.dart';
import 'package:inplayer_android/services/ai_assist_service.dart';

void main() {
  group('VideoPreviewGate', () {
    test('releases the slot so the same card can restart preview without waiting for cooldown', () {
      final gate = VideoPreviewGate.instance;

      gate.activeCardId.value = null;
      gate.requestActivePreview('card-a');
      expect(gate.activeCardId.value, 'card-a');

      gate.releaseActivePreview('card-a');
      expect(gate.activeCardId.value, isNull);

      gate.requestActivePreview('card-a');
      expect(gate.activeCardId.value, 'card-a');
    });
  });

  group('AIAssistService', () {
    test('parseTitleSuggestions strips intro lines and bullet prefixes', () {
      const raw = '''
Here are some ideas:
• Never Skip This Boss Fight Again
- I Built My First 4K Setup
1. The 5-Minute Fix That Changed My Streaming Setup
''';

      final parsed = AIAssistService.parseTitleSuggestions(raw, max: 5);

      expect(parsed, contains('Never Skip This Boss Fight Again'));
      expect(parsed, contains('I Built My First 4K Setup'));
      expect(parsed, contains('The 5-Minute Fix That Changed My Streaming Setup'));
      expect(parsed, isNot(contains('Here are some ideas:')));
    });
  });
}
