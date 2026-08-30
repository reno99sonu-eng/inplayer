import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/network/dio_client.dart';

/// What kind of copy to ask the model for. Mirrors the website's own
/// `buildAIGeneratePrompt(type, ctx)` union exactly.
enum AIGenerateType { title, description, tags }

/// Everything the prompt builder needs about the upload in progress.
/// Direct port of `AIPromptContext` in `app/lib/aiPrompts.ts`.
class AIPromptContext {
  final String title;
  final String description;
  final String category;

  /// 'video' | 'short' | 'music'
  final String contentType;

  /// Free text the creator typed specifically to help the AI. The model
  /// cannot watch the video, so when this is present it is by far the
  /// strongest signal available — it is what stopped titles coming back
  /// near-random on the website, where the prompt previously had nothing
  /// but a filename and a category to work from.
  final String? userDescription;

  const AIPromptContext({
    required this.title,
    required this.description,
    required this.category,
    required this.contentType,
    this.userDescription,
  });
}

/// Client for the website's `/api/ai-generate` and `/api/ai-thumbnail`
/// routes, plus a faithful port of the prompt builder and response parser
/// that sit in front of them.
///
/// The prompt construction is ported line-for-line from
/// `app/lib/aiPrompts.ts` rather than reinvented. That file exists on the
/// website precisely so its two callers (the upload flow and the My Channel
/// edit panel) can never ask the model two different questions; the app
/// being a third caller that asks a *third* question would defeat the point,
/// and the five-tone title instruction in particular is load-bearing — drop
/// it and the five suggestions come back as one voice restyled five times.
class AIAssistService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// Generous per-request timeouts. The route itself allows the model up to
  /// 60s (PER_CALL_TIMEOUT_MS) and will fall back through more than one
  /// candidate model before giving up, so DioClient's shared 30s default is
  /// far too tight — exactly the same trap that made uploads report a
  /// spurious "network error".
  static final _aiOptions = Options(
    sendTimeout: const Duration(seconds: 60),
    receiveTimeout: const Duration(minutes: 3),
  );

  /// A freshly-picked file's title defaults to its filename — camera exports
  /// like "VID_20260714_183022" or "IMG_4821" carry no content signal at
  /// all. Feeding that in as if it were a real working title is exactly why
  /// suggestions came back looking random, so detect the shape and tell the
  /// model to ignore it instead.
  static bool _looksLikeAutoFilename(String title) {
    final t = title.trim();
    if (t.isEmpty) return true;
    if (RegExp(r'^(?:img|vid|dcim|video|movie|clip|mov|rec)[-_ ]?\d{3,}',
            caseSensitive: false)
        .hasMatch(t)) {
      return true;
    }
    if (RegExp(r'^\d{6,}').hasMatch(t)) return true;
    if (RegExp(r'^[a-f0-9]{8}-[a-f0-9-]{4,}$', caseSensitive: false)
        .hasMatch(t)) {
      return true;
    }
    return false;
  }

  static String buildPrompt(AIGenerateType type, AIPromptContext ctx) {
    final format = ctx.contentType == 'short'
        ? 'vertical short-form video (like a Reel/Short)'
        // Naming the format matters: without it the model writes video copy
        // ("watch", "in this video") for something nobody watches.
        : ctx.contentType == 'music'
            ? 'music track / song (audio only — the listener sees cover art, not footage)'
            : 'video';

    final titleLine = _looksLikeAutoFilename(ctx.title)
        ? 'No real title yet — the current value is just an auto-generated filename, ignore it as content signal.'
        : 'Working title: ${ctx.title.trim()}';

    final descriptionLine = ctx.description.trim().isNotEmpty
        ? 'Description: ${ctx.description.trim()}'
        : 'No description written yet.';

    final creatorContextLine = (ctx.userDescription?.trim().isNotEmpty ?? false)
        ? "What this video is actually about, in the creator's own words: ${ctx.userDescription!.trim()}"
        : null;

    final context = [
      'This is a ${ctx.category} $format.',
      creatorContextLine,
      titleLine,
      descriptionLine,
    ].whereType<String>().join('\n');

    switch (type) {
      case AIGenerateType.title:
        return '$context\n\n'
            'Generate five title options appropriate for the ${ctx.category} category'
            '${ctx.contentType == 'short' ? ' and short-form format (short, punchy, under 60 characters).' : '.'}'
            ' Each of the five must be written in a genuinely different TONE, not just a different structure — use exactly these five tones, one per title, in this order: '
            '(1) high-CTR/clickbait — bold, urgent, makes a big promise; '
            '(2) funny/playful — a light, witty, or self-aware title; '
            '(3) dramatic/urgent — intense, high-stakes phrasing; '
            '(4) minimal/understated — plain, quiet, confident, no hype at all; '
            '(5) a genuine, curious question a real viewer would ask themselves. '
            'They should read like five different creators wrote them, not one voice restyled five times. Return ONLY the five titles, one per line, no numbering, no quotation marks, no labels identifying the tone.';
      case AIGenerateType.description:
        return '$context\n\nWrite a professional, engaging $format description a viewer would actually want to read, appropriate for the ${ctx.category} category. Return ONLY the description.';
      case AIGenerateType.tags:
        return '$context\n\nGenerate 15 SEO-friendly, relevant tags for this ${ctx.category} $format. Return ONLY comma-separated tags, no hashtags, no numbering.';
    }
  }

  /// Cleans the model's raw multi-line response into a deduped, capped list.
  /// Port of `parseAITitleSuggestions`.
  static List<String> parseTitleSuggestions(String rawText, {int max = 5}) {
    final seen = <String>{};
    final cleaned = <String>[];

    for (final line in rawText.split('\n')) {
      var t = line.trim();
      if (t.isEmpty) continue;

      t = t.replaceFirst(RegExp(r'^[•\-\*]\s*'), '');
      t = t.replaceFirst(RegExp(r'^\s*\d+[).\-\s]*'), '');
      t = t.replaceFirst(
        RegExp(r"^(?:here are|here's|some ideas?|suggestions?)\s*[:\-]?\s*", caseSensitive: false),
        '',
      );
      t = t.replaceFirst(
        RegExp(r'^(?:title|titles|idea|ideas)\s*[:\-]?\s*', caseSensitive: false),
        '',
      );
      t = t.replaceAll(RegExp(r'''^["'“”‘’]+|["'“”‘’]+$'''), '');
      t = t.trim();

      if (t.isEmpty) continue;
      final lowered = t.toLowerCase();
      if (lowered.contains('here are') ||
          lowered.contains('suggestions') ||
          lowered.contains('generated') ||
          lowered.contains('ideas')) {
        continue;
      }

      final key = lowered;
      if (seen.contains(key)) continue;
      seen.add(key);
      cleaned.add(t);
      if (cleaned.length >= max) break;
    }
    return cleaned;
  }

  /// Comma-separated tag response → a clean list, matching how the website
  /// applies the `tags` generation result.
  static List<String> parseTags(String rawText, {int max = 15}) {
    final seen = <String>{};
    final out = <String>[];
    for (final raw in rawText.split(RegExp(r'[,\n]'))) {
      final t = raw.replaceAll('#', '').trim();
      if (t.isEmpty) continue;
      final key = t.toLowerCase();
      if (!seen.add(key)) continue;
      out.add(t);
      if (out.length >= max) break;
    }
    return out;
  }

  /// POST /api/ai-generate — returns the raw `text` the model produced, or
  /// throws [AIAssistException] carrying a message worth showing a person.
  Future<String> generate(String prompt) async {
    try {
      final response = await _dio.post(
        '/api/ai-generate',
        data: {'prompt': prompt},
        options: _aiOptions,
      );

      final data = response.data;
      if (response.statusCode == 200 && data is Map && data['text'] is String) {
        final text = (data['text'] as String).trim();
        if (text.isNotEmpty) return text;
        throw const AIAssistException('The AI returned an empty response.');
      }

      final serverError = data is Map ? data['error'] as String? : null;
      throw AIAssistException(
        serverError ?? 'AI is unavailable right now. Please try again shortly.',
      );
    } on AIAssistException {
      rethrow;
    } catch (e) {
      _logger.e('AI generate failed: $e');
      if (e is DioException &&
          (e.type == DioExceptionType.connectionTimeout ||
              e.type == DioExceptionType.receiveTimeout ||
              e.type == DioExceptionType.sendTimeout)) {
        throw const AIAssistException(
          'The AI took too long to respond. Please try again.',
        );
      }
      throw const AIAssistException(
        'Could not reach the AI service. Check your connection and try again.',
      );
    }
  }

  /// Five title options for the upload in progress.
  Future<List<String>> suggestTitles(AIPromptContext ctx) async {
    final raw = await generate(buildPrompt(AIGenerateType.title, ctx));
    final suggestions = parseTitleSuggestions(raw);
    if (suggestions.isEmpty) {
      throw const AIAssistException('The AI did not return any usable titles.');
    }
    return suggestions;
  }

  Future<String> suggestDescription(AIPromptContext ctx) =>
      generate(buildPrompt(AIGenerateType.description, ctx));

  Future<List<String>> suggestTags(AIPromptContext ctx) async {
    final raw = await generate(buildPrompt(AIGenerateType.tags, ctx));
    return parseTags(raw);
  }

  /// POST /api/ai-thumbnail.
  ///
  /// The route has two modes. With [frameUrls] it asks a vision model to
  /// pick the strongest frame out of candidates already extracted from the
  /// asset; with [generateNew] it asks DALL-E for an entirely new image.
  /// Both return the same `{thumbnailUrl, reason}` shape, so callers do not
  /// have to care which ran.
  Future<AIThumbnailResult> pickThumbnail({
    required String title,
    required String category,
    List<String> frameUrls = const [],
    bool generateNew = false,
    String? prompt,
  }) async {
    try {
      final response = await _dio.post(
        '/api/ai-thumbnail',
        data: {
          'title': title,
          'category': category,
          if (frameUrls.isNotEmpty) 'frameUrls': frameUrls,
          if (generateNew) 'generateNew': true,
          if (prompt != null && prompt.isNotEmpty) 'prompt': prompt,
        },
        options: _aiOptions,
      );

      final data = response.data;
      if (response.statusCode == 200 &&
          data is Map &&
          data['thumbnailUrl'] is String) {
        return AIThumbnailResult(
          thumbnailUrl: data['thumbnailUrl'] as String,
          reason: data['reason'] as String?,
          generated: data['generated'] == true,
        );
      }

      final serverError = data is Map ? data['error'] as String? : null;
      throw AIAssistException(
        serverError ?? 'Could not generate a thumbnail right now.',
      );
    } on AIAssistException {
      rethrow;
    } catch (e) {
      _logger.e('AI thumbnail failed: $e');
      throw const AIAssistException(
        'Could not generate a thumbnail right now. Please try again.',
      );
    }
  }
}

class AIThumbnailResult {
  final String thumbnailUrl;
  final String? reason;
  final bool generated;

  const AIThumbnailResult({
    required this.thumbnailUrl,
    this.reason,
    this.generated = false,
  });
}

/// Carries a message already phrased for a person, so call sites can show
/// `e.message` straight through instead of inventing their own wording.
class AIAssistException implements Exception {
  final String message;
  const AIAssistException(this.message);

  @override
  String toString() => message;
}

final aiAssistServiceProvider = Provider<AIAssistService>((ref) {
  return AIAssistService();
});
