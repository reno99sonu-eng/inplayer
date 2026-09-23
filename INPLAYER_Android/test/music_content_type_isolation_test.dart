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
//
// Video.isMusic itself used to also flip true from category == "Music"
// (the exact leak this file guards against) — fixed independently at the
// field-computation level in Video.fromJson (isMusicTrack no longer
// checks rawCategory at all, only contentType/isMusic-flag aliases), so
// isMusic is now strict on this axis too. isStrictMusic remains the
// narrower, single-source-of-truth check (contentType == "music" only,
// no aliases like "audio"/"song"/"track") and is what every music-only
// surface should keep using.
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
      'isMusic no longer flips true for category == "Music" either — '
      'the leak was fixed at the field-computation level, not just via '
      'isStrictMusic',
      () {
        final categorizedAsMusic = Video.fromJson({
          'videoId': 'v4',
          'title': 'A Music Documentary',
          'contentType': 'video',
          'category': 'Music',
        });
        expect(categorizedAsMusic.isMusic, isFalse);
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
