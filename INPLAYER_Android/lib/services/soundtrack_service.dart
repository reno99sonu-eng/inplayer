import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/network/dio_client.dart';
import '../models/soundtrack.dart';

/// Live search against real Creative Commons music, via the website's
/// `/api/music/search` (Jamendo-backed).
///
/// The app deliberately does NOT talk to Jamendo directly: the client id
/// lives in the website's server environment, results are already normalised
/// there into the exact `ResolvedSoundtrack` shape stored on an upload, and
/// the route already filters to licences that permit commercial use
/// (`ccnc=false`). Reimplementing any of that here would mean two places to
/// keep in step on a licensing question.
class SoundtrackService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// Empty query returns an empty list without a request — matching the
  /// route, which short-circuits the same way.
  Future<List<ResolvedSoundtrack>> search(String query) async {
    final q = query.trim();
    if (q.isEmpty) return const [];

    try {
      final response = await _dio.get(
        '/api/music/search',
        queryParameters: {'q': q},
        options: Options(receiveTimeout: const Duration(seconds: 30)),
      );

      final data = response.data;
      if (response.statusCode != 200 || data is! Map) {
        final message = data is Map ? data['error'] as String? : null;
        throw SoundtrackSearchException(
          message ?? "Couldn't search music right now. Please try again shortly.",
        );
      }

      final raw = data['tracks'];
      if (raw is! List) return const [];

      return raw
          .whereType<Map>()
          .map((m) => ResolvedSoundtrack.fromJson(Map<String, dynamic>.from(m)))
          // The route already drops entries without a playable url, but a
          // track with no audio is worse than no result — it looks pickable
          // and then plays nothing.
          .where((t) => t.url.isNotEmpty)
          .toList();
    } on SoundtrackSearchException {
      rethrow;
    } catch (e) {
      _logger.e('Music search failed: $e');
      throw const SoundtrackSearchException(
        "Couldn't search music right now. Check your connection and try again.",
      );
    }
  }

  /// Turns a pasted audio link into a pickable track.
  ///
  /// No validation beyond "is this a plausible http(s) URL" — the platform
  /// has no way to verify what is behind an arbitrary link, and pretending
  /// otherwise would be worse than being explicit. What it DOES do is mark
  /// the result `custom`, which is what triggers the hard
  /// [customAudioMaxSeconds] playback cap everywhere downstream, including a
  /// re-clamp server-side.
  ResolvedSoundtrack? fromCustomUrl(String rawUrl, {String? title}) {
    final url = rawUrl.trim();
    if (url.isEmpty) return null;
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme || !(uri.isScheme('http') || uri.isScheme('https'))) {
      return null;
    }

    final guessedTitle = title?.trim().isNotEmpty == true
        ? title!.trim()
        : (uri.pathSegments.isNotEmpty && uri.pathSegments.last.isNotEmpty
            ? Uri.decodeComponent(uri.pathSegments.last)
            : 'Custom audio');

    return ResolvedSoundtrack(
      id: 'custom:$url',
      title: guessedTitle,
      artist: 'Your audio',
      url: url,
      // The cap, not a measurement — nothing here has heard the file.
      durationSeconds: customAudioMaxSeconds.toDouble(),
      source: SoundtrackSource.custom,
    );
  }
}

class SoundtrackSearchException implements Exception {
  final String message;
  const SoundtrackSearchException(this.message);

  @override
  String toString() => message;
}

final soundtrackServiceProvider = Provider<SoundtrackService>((ref) {
  return SoundtrackService();
});
