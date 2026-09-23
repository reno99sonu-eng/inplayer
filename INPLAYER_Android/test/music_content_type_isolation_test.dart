import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/models/video.dart';

// Regression coverage for the music content-type isolation rule: only
// contentType === "music" is music. A video merely categorized under
// "Music" (or any other music-sounding string) must never be treated as
// music by anything that gates entry into a music-only surface (the Music
// hub catalogue, the autoplay queue, the in-app music player stage — see
// Video.isStrictMusic and its call sites in music_page.dart,
// music_player_service.dart, genre_page.dart, liked_music_page.dart,
// watch_page.dart).
void main() {
  group('Video.isStrictMusic', () {
    test('is true only for contentType == "music"', () {
      final music = Video.fromJson({
        'videoId': 'v1',
        'title': 'A Song',
        'contentType': 'music',
        'category': 'Music',
      });
      expect(music.isStrictMusic, isTrue);
    });

    test('is false for a video merely categorized "Music"', () {
      final categorizedAsMusic = Video.fromJson({
        'videoId': 'v2',
        'title': 'A Music Documentary',
        'contentType': 'video',
        'category': 'Music',
      });
      expect(categorizedAsMusic.isStrictMusic, isFalse);
    });

    test('is false for a Short even if categorized "Music"', () {
      final short = Video.fromJson({
        'videoId': 'v3',
        'title': 'A Music Short',
        'contentType': 'short',
        'category': 'Music',
      });
      expect(short.isStrictMusic, isFalse);
    });

    test(
      'isMusic (the lenient getter) stays true for category == "Music" — '
      'intentional for EXCLUDING music from general video surfaces, never '
      'for INCLUDING content into a music-only surface',
      () {
        final categorizedAsMusic = Video.fromJson({
          'videoId': 'v4',
          'title': 'A Music Documentary',
          'contentType': 'video',
          'category': 'Music',
        });
        expect(categorizedAsMusic.isMusic, isTrue);
        expect(categorizedAsMusic.isStrictMusic, isFalse);
      },
    );

    test('a plain video with an unrelated category is neither', () {
      final plain = Video.fromJson({
        'videoId': 'v5',
        'title': 'A Vlog',
        'contentType': 'video',
        'category': 'Entertainment',
      });
      expect(plain.isMusic, isFalse);
      expect(plain.isStrictMusic, isFalse);
    });
  });
}
