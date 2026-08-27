/// One parsed WebVTT cue — a time range and the text shown during it.
class CaptionCue {
  final Duration start;
  final Duration end;
  final String text;
  const CaptionCue({required this.start, required this.end, required this.text});
}

/// A minimal WebVTT parser for the plain-text caption files served by
/// `GET /api/videos/{videoId}/captions/{lang}` (see app/lib/vttChunker.ts,
/// which already chunks these into short 1-2 line YouTube-style cues before
/// they ever reach the client). There's no HLS text-track API exposed by
/// this app's `video_player`/ExoPlayer integration the way the website's
/// `<mux-player>` has built in, so rather than leaving captions unbuilt,
/// this fetches the same underlying WebVTT the website's caption pipeline
/// produces and renders it as a synced overlay driven off the controller's
/// own position — same source of truth, different renderer.
class WebVttParser {
  WebVttParser._();

  static final RegExp _timingLine = RegExp(
    r'(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}\s*-->\s*(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}',
  );

  static final RegExp _timestamp =
      RegExp(r'^(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{3})$');

  static List<CaptionCue> parse(String vtt) {
    final lines = vtt.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
    final cues = <CaptionCue>[];

    int i = 0;
    // Skip the WEBVTT header/metadata block up to the first real timing
    // line — cue identifiers (a bare line before the timing line) and NOTE
    // blocks are skipped the same way, since neither matches _timingLine.
    while (i < lines.length && !_timingLine.hasMatch(lines[i])) {
      i++;
    }

    while (i < lines.length) {
      final line = lines[i];
      if (!_timingLine.hasMatch(line)) {
        i++;
        continue;
      }

      final parts = line.split('-->');
      if (parts.length < 2) {
        i++;
        continue;
      }

      final start = _parseTimestamp(parts[0].trim());
      // The text after the end timestamp may carry cue settings
      // ("align:middle line:90%") — only the first token is the time.
      final endToken = parts[1].trim().split(RegExp(r'\s+')).first;
      final end = _parseTimestamp(endToken);
      i++;

      final textLines = <String>[];
      while (i < lines.length && lines[i].trim().isNotEmpty && !_timingLine.hasMatch(lines[i])) {
        textLines.add(lines[i]);
        i++;
      }

      if (start != null && end != null && end > start && textLines.isNotEmpty) {
        final text = _stripTags(textLines.join('\n').trim());
        if (text.isNotEmpty) {
          cues.add(CaptionCue(start: start, end: end, text: text));
        }
      }

      while (i < lines.length && lines[i].trim().isEmpty) {
        i++;
      }
    }

    return cues;
  }

  static Duration? _parseTimestamp(String raw) {
    final match = _timestamp.firstMatch(raw.trim());
    if (match == null) return null;
    final hours = int.tryParse(match.group(1) ?? '0') ?? 0;
    final minutes = int.tryParse(match.group(2) ?? '0') ?? 0;
    final seconds = int.tryParse(match.group(3) ?? '0') ?? 0;
    final millis = int.tryParse(match.group(4) ?? '0') ?? 0;
    return Duration(hours: hours, minutes: minutes, seconds: seconds, milliseconds: millis);
  }

  // Strips WebVTT inline markup (<b>, <i>, <c.classname>, <v Speaker>, and
  // timestamp karaoke tags) down to plain text. This app renders captions
  // as plain styled text, which matches how the overwhelming majority of
  // these auto-generated/translated cues look anyway — they carry no
  // styling tags at all (see app/lib/vttChunker.ts / app/lib/translate.ts).
  static String _stripTags(String text) {
    return text.replaceAll(RegExp(r'<[^>]*>'), '');
  }

  /// The cue active at [position], or null if none. Cues are assumed
  /// sorted by start time (true of every VTT this endpoint serves), so a
  /// binary search is safe and avoids a linear scan on every player tick.
  static CaptionCue? cueAt(List<CaptionCue> cues, Duration position) {
    int lo = 0, hi = cues.length - 1;
    while (lo <= hi) {
      final mid = (lo + hi) >> 1;
      final cue = cues[mid];
      if (position < cue.start) {
        hi = mid - 1;
      } else if (position > cue.end) {
        lo = mid + 1;
      } else {
        return cue;
      }
    }
    return null;
  }
}
