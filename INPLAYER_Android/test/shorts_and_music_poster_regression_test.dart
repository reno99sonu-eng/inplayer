import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/core/utils/image_utils.dart';
import 'package:inplayer_android/models/short.dart';
import 'package:inplayer_android/models/video.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Music Poster and Base64 Data URI Tests', () {
    // 1x1 transparent GIF base64
    const sampleDataUri =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    test('isDataImageUrl identifies data:image URIs accurately', () {
      expect(isDataImageUrl(sampleDataUri), isTrue);
      expect(isDataImageUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg...'), isTrue);
      expect(isDataImageUrl('https://image.mux.com/123/thumbnail.jpg'), isFalse);
      expect(isDataImageUrl('http://inplayer.in/logo.png'), isFalse);
      expect(isDataImageUrl(''), isFalse);
    });

    test('decodeDataImageUrl decodes base64 bytes correctly and utilizes memory cache', () {
      final bytes1 = decodeDataImageUrl(sampleDataUri);
      expect(bytes1, isNotNull);
      expect(bytes1!.isNotEmpty, isTrue);

      // Verify cached retrieval
      final bytes2 = decodeDataImageUrl(sampleDataUri);
      expect(identical(bytes1, bytes2), isTrue);
    });

    test('smartImageProvider returns MemoryImage for data:image URIs', () {
      final provider = smartImageProvider(sampleDataUri);
      expect(provider, isNotNull);
      expect(provider, isA<MemoryImage>());
    });

    test('Video.fromJson preserves base64 data URIs in covers and thumbnail', () {
      final json = {
        'id': 'music_track_test_1',
        'videoId': 'music_track_test_1',
        'title': 'Test Music Track',
        'artist': 'Bhojpuri Audio',
        'creator': 'Bhojpuri Audio',
        'thumbnailUrl': sampleDataUri,
        'covers': [sampleDataUri],
        'contentType': 'music',
        'isMusic': true,
        'muxPlaybackId': 'abc123audio',
      };

      final video = Video.fromJson(json);
      expect(video.isMusic, isTrue);
      expect(video.covers, isNotEmpty);
      expect(video.covers.first, sampleDataUri);
      expect(video.thumbnail, sampleDataUri);
    });

    testWidgets('SafeAppImage renders Image.memory for data:image URIs without crashing',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SafeAppImage(
              imageUrl: sampleDataUri,
              fit: BoxFit.cover,
            ),
          ),
        ),
      );

      // Verify Image widget is rendered with MemoryImage
      final imageFinder = find.byType(Image);
      expect(imageFinder, findsOneWidget);

      final Image imageWidget = tester.widget(imageFinder);
      expect(imageWidget.image, isA<MemoryImage>());
    });

    testWidgets('SafeAppImage falls back gracefully when given empty or invalid URI',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SafeAppImage(
              imageUrl: '',
              errorWidget: (context, url, err) => const Text('ErrorFallback'),
            ),
          ),
        ),
      );

      expect(find.text('ErrorFallback'), findsOneWidget);
    });
  });

  group('Raftaar Shorts Feed Parsing Tests', () {
    test('Short.fromJson parses real Raftaar Shorts video payload correctly', () {
      final json = {
        'id': 'short_test_101',
        'videoId': 'short_test_101',
        'title': 'Yamlok Delivery EP 01',
        'creator': 'Raftaar Creator',
        'uploaderUsername': 'raftaar_user',
        'thumbnailUrl': 'https://image.mux.com/playback_short_1/thumbnail.webp',
        'contentType': 'short',
        'category': 'Entertainment',
        'duration': 45.2,
      };

      final short = Short.fromJson(json);
      expect(short.id, 'short_test_101');
      expect(short.title, 'Yamlok Delivery EP 01');
      expect(short.poster, 'https://image.mux.com/playback_short_1/thumbnail.webp');
    });

    test('Video.isShort recognizes content types and categories correctly', () {
      final shortVideo = Video.fromJson({
        'videoId': 'v1',
        'title': 'Short Title',
        'contentType': 'short',
      });
      expect(shortVideo.isShort, isTrue);

      final raftaarVideo = Video.fromJson({
        'videoId': 'v2',
        'title': 'Raftaar Title',
        'category': 'Raftaar (Vertical Videos)',
      });
      expect(raftaarVideo.isShort, isTrue);

      final normalVideo = Video.fromJson({
        'videoId': 'v3',
        'title': 'Normal Video',
        'contentType': 'video',
        'category': 'Entertainment',
      });
      expect(normalVideo.isShort, isFalse);

      final musicTrack = Video.fromJson({
        'videoId': 'v4',
        'title': 'Music Track',
        'contentType': 'music',
      });
      expect(musicTrack.isShort, isFalse);
      expect(musicTrack.isMusic, isTrue);
    });
  });
}
