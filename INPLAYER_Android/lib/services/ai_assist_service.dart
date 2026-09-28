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

  /// Music metadata is explicit source context because the model cannot
  /// listen to the audio file uploaded by the app.
  final String? musicGenre;
  final String? musicLanguage;

  /// Free text the creator typed specifically to help the AI. The model
  /// cannot watch the video, so when this is present it is by far the
  /// strongest signal available — it is what stopped titles coming back
  /// near-random on the website, where the prompt previously had nothing
  /// but a filename and a category to work from.
  final String? userDescription;

  /// A few real frames from the picked video (or a music track's cover
  /// art) as small JPEG data URLs. Without these the model only ever sees a
  /// category and a camera filename, which is why every description and tag
  /// set came back as the same generic filler regardless of the upload.
  final List<String> images;

  const AIPromptContext({
    required this.title,
    required this.description,
    required this.category,
    required this.contentType,
    this.musicGenre,
    this.musicLanguage,
    this.userDescription,
    this.images = const [],
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
  static bool looksLikeAutoFilename(String title) {
    final t = title.trim();
    if (t.isEmpty) return true;
    if (RegExp(
      r'^(?:img|vid|dcim|video|movie|clip|mov|rec)[-_ ]?\d{3,}',
      caseSensitive: false,
    ).hasMatch(t)) {
      return true;
    }
    if (RegExp(r'^\d{6,}').hasMatch(t)) return true;
    if (RegExp(
      r'^[a-f0-9]{8}-[a-f0-9-]{4,}$',
      caseSensitive: false,
    ).hasMatch(t)) {
      return true;
    }
    return false;
  }

  static String buildPrompt(AIGenerateType type, AIPromptContext ctx) {
    final isMusic =
        ctx.contentType == 'music' || ctx.category.toLowerCase() == 'music';
    final isShort =
        ctx.contentType == 'short' ||
        ctx.category.toLowerCase().contains('short') ||
        ctx.category.toLowerCase().contains('raftaar');

    final format = isShort
        ? 'vertical short-form video (like a Reel/Short)'
        : isMusic
        ? 'music track / song (audio track with cover art, not a video)'
        : 'video';

    final titleLine = looksLikeAutoFilename(ctx.title)
        ? 'No real title yet — the current value is just an auto-generated filename, ignore it as content signal.'
        : 'Working title: ${ctx.title.trim()}';

    final descriptionLine = ctx.description.trim().isNotEmpty
        ? 'Description: ${ctx.description.trim()}'
        : 'No description written yet.';

    final creatorContextLine = (ctx.userDescription?.trim().isNotEmpty ?? false)
        ? "What this content is actually about, in the creator's own words: ${ctx.userDescription!.trim()}"
        : null;

    final musicMetadata = isMusic
        ? [
            if ((ctx.musicGenre?.trim().isNotEmpty ?? false))
              if (ctx.musicGenre!.trim().toLowerCase() != 'other')
                'Track genre: ${ctx.musicGenre!.trim()}',
            if ((ctx.musicLanguage?.trim().isNotEmpty ?? false))
              if (ctx.musicLanguage!.trim().toLowerCase() != 'other')
                'Track language: ${ctx.musicLanguage!.trim()}',
          ]
        : const <String>[];

    final context = [
      'This is a ${ctx.category} $format.',
      creatorContextLine,
      ...musicMetadata,
      titleLine,
      descriptionLine,
    ].whereType<String>().join('\n');

    final accuracyNote = isMusic
        ? 'Use only the title, creator description, genre and language as facts. The attached cover art is not the audio: do not claim specific lyrics, instruments, tempo, or sound qualities unless the creator stated them.'
        : ctx.images.isNotEmpty
        ? 'Use only details supported by the creator context and the attached real frames. Do not invent people, locations, events, or actions. If the source does not establish a detail, leave it out.'
        : 'Use only details stated in the creator-provided context above. Do not infer people, locations, events, or actions from the category or filename.';
    final groundedContext = '$context\n$accuracyNote';

    switch (type) {
      case AIGenerateType.title:
        if (isMusic) {
          return '$groundedContext\n\n'
              'Generate five artistic, radio-ready song title options for this music track/song in the ${ctx.category} genre. '
              'The five titles must each follow these distinct creative styles:\n'
              '(1) Poetic / emotional — heartfelt, soulful title that captures the feeling;\n'
              '(2) Catchy / radio hook — memorable, melodic, radio-ready phrase;\n'
              '(3) Rhythm / beat-driven — stylish groove, upbeat, or atmospheric vibe;\n'
              '(4) Modern Indian / Desi flavor — culturally resonant, bilingual (Hindi/English mix) or evocative Desi touch;\n'
              '(5) Minimalist aesthetic — one or two iconic words, clean and timeless.\n'
              'Return ONLY the five song titles, one per line, no numbering, no quotation marks, no labels identifying the style.';
        } else if (isShort) {
          return '$groundedContext\n\n'
              'Generate five viral, scroll-stopping title hooks for this short-form vertical video (Raftaar/Short). '
              'Each title MUST be under 50 characters, punchy, and follow these 5 viral hook styles:\n'
              '(1) Curiosity hook — irresistible scroll-stopper;\n'
              '(2) Relatable POV hook — relatable viewer perspective (e.g. "POV:", "When you...");\n'
              '(3) Trend / challenge hook — high-energy trending style;\n'
              '(4) Question / mystery hook — compels the viewer to watch till the end;\n'
              '(5) Bold & punchy phrase — short, striking statement.\n'
              'Return ONLY the five titles, one per line, strictly under 50 characters each, no numbering, no quotation marks, no labels.';
        } else {
          return '$groundedContext\n\n'
              'Generate five title options appropriate for the ${ctx.category} category. '
              'Each of the five must be written in a genuinely different TONE, not just a different structure — use exactly these five tones, one per title, in this order: '
              '(1) high-CTR/clickbait — bold, urgent, makes a big promise; '
              '(2) funny/playful — a light, witty, or self-aware title; '
              '(3) dramatic/urgent — intense, high-stakes phrasing; '
              '(4) minimal/understated — plain, quiet, confident, no hype at all; '
              '(5) a genuine, curious question a real viewer would ask themselves. '
              'They should read like five different creators wrote them, not one voice restyled five times. Return ONLY the five titles, one per line, no numbering, no quotation marks, no labels identifying the tone.';
        }

      case AIGenerateType.description:
        if (isMusic) {
          return '$groundedContext\n\n'
              'Write a concise music release description for listeners using only the supported source facts above. '
              'Do not infer the sound, lyrics, mood, instruments, tempo, or artist message from the title or cover art. '
              'Include an invitation to stream, save to playlists, and share. Keep the result at or under 500 characters. Return ONLY the description.';
        } else if (isShort) {
          return '$groundedContext\n\n'
              'Write a snappy, accurate caption (2 to 3 sentences maximum) for this short-form vertical video. '
              'Include a brief engagement hook and invite viewers to comment or share. Add 3-4 relevant hashtags only when supported by the content. '
              'Keep the result at or under 500 characters. Return ONLY the description.';
        } else {
          return '$groundedContext\n\n'
              'Write a professional, engaging and accurate video description for the ${ctx.category} category. '
              'Summarize only what the source establishes; do not make up events or promise details the video may not contain. '
              'Invite viewers to subscribe and comment. Keep the result at or under 500 characters. Return ONLY the description.';
        }

      case AIGenerateType.tags:
        if (isMusic) {
          return '$groundedContext\n\n'
              'Generate up to 15 relevant music discovery tags for this ${ctx.category} track. Use only the known genre, language, title and creator-provided details; '
              'do not guess mood, tempo, instruments, lyrics or subgenre. '
              'Return ONLY comma-separated tags, no hashtags, no numbering.';
        } else if (isShort) {
          return '$groundedContext\n\n'
              'Generate up to 15 relevant discoverability tags for this ${ctx.category} short-form vertical video (like Raftaar/Shorts/Reels). '
              'Return ONLY comma-separated tags, no hashtags, no numbering.';
        } else {
          return '$groundedContext\n\n'
              'Generate up to 15 SEO-friendly, relevant search tags for this ${ctx.category} video. '
              'Use only supported facts from the source. Return ONLY comma-separated tags, no hashtags, no numbering.';
        }
    }
  }

  /// Cleans the model's raw multi-line response into a deduped, capped list.
  /// Port of `parseAITitleSuggestions`.
  static List<String> parseTitleSuggestions(
    String rawText, {
    int max = 5,
    int? maxLength,
  }) {
    if (max <= 0) return const [];
    final seen = <String>{};
    final cleaned = <String>[];

    for (final line in rawText.split('\n')) {
      var t = line.trim();
      if (t.isEmpty) continue;

      t = t.replaceFirst(RegExp(r'^[•\-\*]\s*'), '');
      t = t.replaceFirst(RegExp(r'^\s*\d+[).\-]\s*'), '');
      if (RegExp(
        r"^(?:here (?:are|is)\b|these are\b|suggestions?\s*[:\-]|generated titles?\s*[:\-])",
        caseSensitive: false,
      ).hasMatch(t)) {
        continue;
      }
      t = t.replaceFirst(
        RegExp(
          r'^(?:title|titles|idea|ideas)\s*[:\-]?\s*',
          caseSensitive: false,
        ),
        '',
      );
      t = t.replaceAll(RegExp(r'''^["'“”‘’]+|["'“”‘’]+$'''), '');
      t = t.trim();

      if (t.isEmpty) continue;
      final lowered = t.toLowerCase();
      if (maxLength != null && t.length > maxLength) continue;

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
    if (max <= 0) return const [];
    final seen = <String>{};
    final out = <String>[];
    for (final line in rawText.split('\n')) {
      var cleanedLine = line.trim();
      if (cleanedLine.isEmpty) continue;
      cleanedLine = cleanedLine.replaceFirst(RegExp(r'^[•\-*]\s*'), '');
      cleanedLine = cleanedLine.replaceFirst(RegExp(r'^\d+[).:\-]\s*'), '');
      cleanedLine = cleanedLine.replaceFirst(
        RegExp(
          r'^(?:here (?:are|is)|these are)\b[^:]{0,100}:\s*',
          caseSensitive: false,
        ),
        '',
      );

      for (final rawTag in cleanedLine.split(RegExp(r'[,;|]'))) {
        var tag = rawTag.trim();
        tag = tag.replaceFirst(
          RegExp(r'^(?:tags?|keywords?)\s*[:\-]\s*', caseSensitive: false),
          '',
        );
        tag = tag.replaceFirst(RegExp(r'^[•\-*]\s*'), '');
        tag = tag.replaceFirst(RegExp(r'^\d+[).:\-]\s*'), '');
        tag = tag.replaceFirst(RegExp(r'^#+'), '').trim();
        tag = tag.replaceAll(RegExp(r'''^["'“”‘’]+|["'“”‘’]+$'''), '').trim();
        if (tag.isEmpty) continue;

        final key = tag.toLowerCase();
        if (!seen.add(key)) continue;
        out.add(tag);
        if (out.length >= max) return out;
      }
    }
    return out;
  }

  static bool _hasSupportingContext(AIPromptContext ctx) {
    if (ctx.images.any(
      (image) =>
          image.startsWith('data:image/') || image.startsWith('https://'),
    )) {
      return true;
    }
    if (ctx.userDescription?.trim().isNotEmpty ?? false) return true;
    if (ctx.description.trim().isNotEmpty) return true;
    if (ctx.contentType == 'music' || ctx.category.toLowerCase() == 'music') {
      final genre = ctx.musicGenre?.trim();
      final language = ctx.musicLanguage?.trim();
      return (genre?.isNotEmpty == true && genre!.toLowerCase() != 'other') ||
          (language?.isNotEmpty == true && language!.toLowerCase() != 'other');
    }
    return false;
  }

  static void _requireSupportingContext(AIPromptContext ctx, String task) {
    if (_hasSupportingContext(ctx)) return;
    throw AIAssistException(
      'Add a short description or wait for video frames to load before generating an accurate $task.',
    );
  }

  static bool _hasMusicTextContext(AIPromptContext ctx) {
    final genre = ctx.musicGenre?.trim();
    final language = ctx.musicLanguage?.trim();
    return ctx.description.trim().isNotEmpty ||
        (ctx.userDescription?.trim().isNotEmpty ?? false) ||
        (genre?.isNotEmpty == true && genre!.toLowerCase() != 'other') ||
        (language?.isNotEmpty == true && language!.toLowerCase() != 'other');
  }

  static String? _serverErrorMessage(Object? data) {
    if (data is! Map) return null;
    final message = data['error'];
    return message is String && message.trim().isNotEmpty
        ? message.trim()
        : null;
  }

  static bool _isTimeout(DioException error) =>
      error.type == DioExceptionType.connectionTimeout ||
      error.type == DioExceptionType.receiveTimeout ||
      error.type == DioExceptionType.sendTimeout;

  /// POST /api/ai-generate — returns the raw `text` the model produced, or
  /// throws [AIAssistException] carrying a message worth showing a person.
  Future<String> generate(
    String prompt, {
    List<String> images = const [],
  }) async {
    try {
      final response = await _dio.post(
        '/api/ai-generate',
        data: {'prompt': prompt, if (images.isNotEmpty) 'images': images},
        options: _aiOptions,
      );

      final data = response.data;
      if (response.statusCode == 200 && data is Map && data['text'] is String) {
        final text = (data['text'] as String).trim();
        if (text.isNotEmpty) {
          if (images.isNotEmpty && data['grounded'] != true) {
            throw const AIAssistException(
              'The AI could not read the upload frames. Add a short description and try again.',
            );
          }
          return text;
        }
        throw const AIAssistException('The AI returned an empty response.');
      }

      throw AIAssistException(
        _serverErrorMessage(data) ??
            'AI is unavailable right now. Please try again shortly.',
      );
    } on AIAssistException {
      rethrow;
    } on DioException catch (e) {
      _logger.e('AI generate failed: $e');
      if (_isTimeout(e)) {
        throw const AIAssistException(
          'The AI took too long to respond. Please try again.',
        );
      }
      final serverError = _serverErrorMessage(e.response?.data);
      if (serverError != null) throw AIAssistException(serverError);
      throw const AIAssistException(
        'Could not reach the AI service. Check your connection and try again.',
      );
    } catch (e) {
      _logger.e('AI generate failed: $e');
      throw const AIAssistException(
        'Could not reach the AI service. Check your connection and try again.',
      );
    }
  }

  /// Five title options for the upload in progress.
  Future<List<String>> suggestTitles(AIPromptContext ctx) async {
    _requireSupportingContext(ctx, 'titles');
    if ((ctx.contentType == 'music' || ctx.category.toLowerCase() == 'music') &&
        !_hasMusicTextContext(ctx)) {
      throw const AIAssistException(
        'Add a track description or select its genre or language before generating music titles.',
      );
    }
    final raw = await generate(
      buildPrompt(AIGenerateType.title, ctx),
      images: ctx.images,
    );
    final isShort =
        ctx.contentType == 'short' ||
        ctx.category.toLowerCase().contains('short') ||
        ctx.category.toLowerCase().contains('raftaar');
    final suggestions = parseTitleSuggestions(
      raw,
      maxLength: isShort ? 49 : 100,
    );
    if (suggestions.isEmpty) {
      throw AIAssistException(
        isShort
            ? 'The AI did not return a usable title under 50 characters. Please try again.'
            : 'The AI did not return a usable title under 100 characters. Please try again.',
      );
    }
    return suggestions;
  }

  Future<String> suggestDescription(AIPromptContext ctx) async {
    _requireSupportingContext(ctx, 'description');
    if ((ctx.contentType == 'music' || ctx.category.toLowerCase() == 'music') &&
        !_hasMusicTextContext(ctx)) {
      throw const AIAssistException(
        'Add a track description or select its genre or language before generating a music description.',
      );
    }
    final text = await generate(
      buildPrompt(AIGenerateType.description, ctx),
      images: ctx.images,
    );
    if (text.length > 500) {
      throw const AIAssistException(
        'The AI returned more than the 500-character limit. Please try again.',
      );
    }
    return text;
  }

  Future<List<String>> suggestTags(AIPromptContext ctx) async {
    _requireSupportingContext(ctx, 'tags');
    if ((ctx.contentType == 'music' || ctx.category.toLowerCase() == 'music') &&
        !_hasMusicTextContext(ctx)) {
      throw const AIAssistException(
        'Add a track description or select its genre or language before generating music tags.',
      );
    }
    final raw = await generate(
      buildPrompt(AIGenerateType.tags, ctx),
      images: ctx.images,
    );
    final tags = parseTags(raw);
    if (tags.isEmpty) {
      throw const AIAssistException('The AI did not return any usable tags.');
    }
    return tags;
  }

  /// POST /api/ai-thumbnail.
  ///
  /// The route has two modes. With [frameUrls] it asks a vision model to
  /// pick the strongest frame out of candidates already extracted from the
  /// asset; with [generateNew] it asks DALL-E/GPT-Image for an entirely new image.
  /// Both return the same `{thumbnailUrl, reason}` shape, so callers do not
  /// have to care which ran.
  Future<AIThumbnailResult> pickThumbnail({
    required String title,
    required String category,
    // 'video' | 'short' | 'music' — decides the crop the server applies
    // (16:9 / 9:16 / 1:1, see app/lib/contentTypes.ts). Omitted, the route
    // defaults to 'video', which is why a Raftaar/Short AI thumbnail used
    // to come back landscape-cropped instead of portrait.
    String contentType = 'video',
    String? description,
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
          'contentType': contentType,
          if (description != null && description.isNotEmpty)
            'description': description,
          if (frameUrls.isNotEmpty) 'frameUrls': frameUrls,
          if (generateNew) 'generateNew': true,
          if (prompt != null && prompt.isNotEmpty) 'prompt': prompt,
        },
        options: _aiOptions,
      );

      final data = response.data;
      if (response.statusCode == 200 &&
          data is Map &&
          data['thumbnailUrl'] is String &&
          (data['thumbnailUrl'] as String).trim().isNotEmpty) {
        final thumbnailUrl = (data['thumbnailUrl'] as String).trim();
        if (!thumbnailUrl.startsWith('data:image/') &&
            !thumbnailUrl.startsWith('https://')) {
          throw const AIAssistException(
            'The AI returned an invalid thumbnail.',
          );
        }
        return AIThumbnailResult(
          thumbnailUrl: thumbnailUrl,
          reason: data['reason'] is String ? data['reason'] as String : null,
          generated: data['generated'] == true,
        );
      }

      throw AIAssistException(
        _serverErrorMessage(data) ??
            'Could not generate a thumbnail right now.',
      );
    } on AIAssistException {
      rethrow;
    } on DioException catch (e) {
      _logger.e('AI thumbnail failed: $e');
      if (_isTimeout(e)) {
        throw const AIAssistException(
          'The AI took too long to choose a thumbnail. Please try again.',
        );
      }
      final serverError = _serverErrorMessage(e.response?.data);
      if (serverError != null) throw AIAssistException(serverError);
      throw const AIAssistException(
        'Could not generate a thumbnail right now. Please try again.',
      );
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
