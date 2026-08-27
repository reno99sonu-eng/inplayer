import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';

/// One caption language available for a video — mirrors CAPTION_TARGETS in
/// app/lib/captions.ts (code/name/label), filtered server-side to only the
/// languages that video actually has (see
/// app/api/videos/[videoId]/captions-list/route.ts).
class CaptionLanguage {
  final String code;
  final String name;
  final String label;
  const CaptionLanguage({required this.code, required this.name, required this.label});

  factory CaptionLanguage.fromJson(Map<String, dynamic> json) => CaptionLanguage(
        code: json['code'] as String? ?? '',
        name: json['name'] as String? ?? '',
        label: json['label'] as String? ?? (json['name'] as String? ?? ''),
      );
}

/// Real closed captions, sourced from the same backend the website's caption
/// pipeline writes to — NOT a re-implementation. The website's own player
/// shows captions via Mux's embedded HLS text tracks (see the
/// `defaultHiddenCaptions` prop in VideoPlayer.tsx), which `video_player`'s
/// ExoPlayer wrapper has no API to read. Rather than leave captions unbuilt
/// for that reason, this fetches the identical underlying WebVTT through the
/// REST endpoints the backend already exposes for exactly this kind of
/// external consumption:
///   GET /api/videos/{videoId}/captions-list  -> { languages: [...] }
///   GET /api/videos/{videoId}/captions/{lang} -> raw WebVTT (text/vtt)
class CaptionService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<List<CaptionLanguage>> getLanguages(String videoId) async {
    if (videoId.isEmpty) return [];
    try {
      final response = await _dio.get('/api/videos/$videoId/captions-list');
      if (response.statusCode == 200 && response.data != null) {
        final list = response.data['languages'] as List? ?? [];
        return list
            .whereType<Map<String, dynamic>>()
            .map(CaptionLanguage.fromJson)
            .where((l) => l.code.isNotEmpty)
            .toList();
      }
    } catch (e) {
      _logger.e('Error fetching caption languages: $e');
    }
    return [];
  }

  /// Returns the raw WebVTT text for [lang], or null if that video has no
  /// captions in that language (404 — no real speech, never generated, or
  /// an unsupported code) or the request failed.
  Future<String?> getVtt(String videoId, String lang) async {
    if (videoId.isEmpty || lang.isEmpty) return null;
    try {
      // Forced to `plain` rather than the client's default `json` response
      // type — this endpoint returns `Content-Type: text/vtt`, and letting
      // Dio's default transformer see a non-JSON content type is exactly
      // the ambiguity worth avoiding here; plain guarantees the raw text
      // body back either way (a 404's small JSON error body included).
      final response = await _dio.get(
        '/api/videos/$videoId/captions/$lang',
        options: Options(responseType: ResponseType.plain),
      );
      if (response.statusCode == 200 && response.data is String) {
        final text = response.data as String;
        return text.startsWith('WEBVTT') ? text : null;
      }
    } catch (e) {
      _logger.e('Error fetching captions ($lang) for $videoId: $e');
    }
    return null;
  }
}

final captionServiceProvider = Provider<CaptionService>((ref) => CaptionService());
