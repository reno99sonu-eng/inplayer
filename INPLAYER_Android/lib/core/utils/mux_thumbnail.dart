/// Direct port of the website's `app/lib/muxThumbnail.ts`.
///
/// Ported rather than approximated on purpose: the frame timestamps and the
/// query string have to match the site exactly, or the app offers a
/// different set of candidate frames than the website does for the very
/// same asset, and the "pick a thumbnail" step stops being parity and
/// starts being a second, competing feature.
library;

const _landscapeThumbnailQuery = 'width=640&height=360&fit_mode=smartcrop&time=1';

/// Shorts are portrait (9:16) source video. Requesting the same 640x360
/// landscape crop for them makes Mux's smartcrop squeeze a tall frame into a
/// wide box, which then gets scaled back up into a portrait card — the
/// combination is what reads as stretched/distorted. 640x1138 is ≈9:16.
const _portraitThumbnailQuery = 'width=640&height=1138&fit_mode=smartcrop&time=1';

/// Public Mux thumbnail URL built from the PLAYBACK id — never the asset or
/// upload id. Public assets need no signed image token.
String? getMuxThumbnailUrl(String playbackId, {bool isPortrait = false}) {
  final id = playbackId.trim();
  if (id.isEmpty) return null;
  final query = isPortrait ? _portraitThumbnailQuery : _landscapeThumbnailQuery;
  return 'https://image.mux.com/${Uri.encodeComponent(id)}/thumbnail.webp?$query';
}

/// A handful of candidate frames spread across a known asset duration, so a
/// creator has real options instead of only ever seeing Mux's default
/// first-second frame.
///
/// Frames are spread across the middle 80% of the video: the very first and
/// last instants are disproportionately likely to be black frames, intro
/// cards, or motion blur from a cut. Falls back to a small fixed set of
/// early timestamps when the duration isn't known (legacy rows uploaded
/// before `duration` was stored).
List<String> getMuxThumbnailCandidates(
  String playbackId, {
  double? durationSeconds,
  int count = 5,
}) {
  final id = playbackId.trim();
  if (id.isEmpty) return const [];

  final List<int> times;
  if (durationSeconds != null && durationSeconds > 1) {
    times = List<int>.generate(count, (i) {
      final fraction = (i + 1) / (count + 1);
      final t =
          (durationSeconds * 0.1 + durationSeconds * 0.8 * fraction).round();
      return t < 1 ? 1 : t;
    });
  } else {
    times = const [1, 2, 5, 10, 15].take(count).toList();
  }

  // Deduped while preserving order — a very short video can round several
  // fractions onto the same second, and five identical thumbnails is worse
  // than three distinct ones.
  final seen = <int>{};
  final out = <String>[];
  for (final t in times) {
    if (!seen.add(t)) continue;
    out.add(
      'https://image.mux.com/${Uri.encodeComponent(id)}/thumbnail.jpg'
      '?width=640&height=360&fit_mode=smartcrop&time=$t',
    );
  }
  return out;
}
