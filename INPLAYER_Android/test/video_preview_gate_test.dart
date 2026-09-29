import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/core/utils/video_preview_gate.dart';
import 'package:inplayer_android/services/ai_assist_service.dart';

void main() {
  group('VideoPreviewGate', () {
    test(
      'releases the slot so the same card can restart preview without waiting for cooldown',
      () {
        final gate = VideoPreviewGate.instance;

        gate.activeCardId.value = null;
        gate.requestActivePreview('card-a');
        expect(gate.activeCardId.value, 'card-a');

        gate.releaseActivePreview('card-a');
        expect(gate.activeCardId.value, isNull);

        gate.requestActivePreview('card-a');
        expect(gate.activeCardId.value, 'card-a');
      },
    );
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
      expect(
        parsed,
        contains('The 5-Minute Fix That Changed My Streaming Setup'),
      );
      expect(parsed, isNot(contains('Here are some ideas:')));
    });

    test(
      'parseTitleSuggestions keeps useful titles and filters unusable lengths',
      () {
        const raw = '''
Here are some ideas:
• 100 Ideas for Better Travel
1. Big Festival, Small City
2. This title is far too long to fit in a short video title field
''';

        final parsed = AIAssistService.parseTitleSuggestions(
          raw,
          maxLength: 30,
        );

        expect(parsed, [
          '100 Ideas for Better Travel',
          'Big Festival, Small City',
        ]);
      },
    );

    test(
      'parseTags removes formatting and deduplicates case-insensitively',
      () {
        const raw = '''
Here are 4 relevant tags: #Ganpati, entertainment
• #Festival
3. Mumbai
#ganpati
''';

        expect(AIAssistService.parseTags(raw), [
          'Ganpati',
          'entertainment',
          'Festival',
          'Mumbai',
        ]);
      },
    );

    test(
      'music prompts use selected metadata without inventing audio details',
      () {
        final prompt = AIAssistService.buildPrompt(
          AIGenerateType.description,
          const AIPromptContext(
            title: 'Monsoon Light',
            description: 'A song about finding hope during the rain.',
            category: 'Music',
            contentType: 'music',
            musicGenre: 'Indie',
            musicLanguage: 'Hindi',
          ),
        );

        expect(prompt, contains('Track genre: Indie'));
        expect(prompt, contains('Track language: Hindi'));
        expect(
          prompt,
          contains('do not claim specific lyrics, instruments, tempo'),
        );
        expect(prompt, contains('at or under 500 characters'));
      },
    );
  });
}
