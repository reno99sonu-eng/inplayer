/// Copyright pre-screening for music uploads — a faithful port of the
/// website's `app/lib/musicCopyright.ts` metadata screen.
///
/// READ THIS BEFORE CHANGING ANYTHING, because the honest limits matter more
/// than the code.
///
/// NO SOFTWARE CAN LISTEN TO A SONG AND KNOW IT IS COPYRIGHTED. When YouTube
/// catches a commercial track, Content ID is not reasoning about it — it is
/// matching an audio FINGERPRINT against a licensed reference database that
/// rights holders handed over. Without that database there is nothing to
/// compare against.
///
/// So the platform does the three things that ARE possible without a
/// licensed catalogue: an ownership declaration, an exact-duplicate hash
/// (`audioSha256`, already sent by this app since Round 24), and the
/// metadata screen ported below. This file is only the third.
///
/// It reads what the creator TYPED, never the audio. That catches naive
/// infringement well — people re-uploading someone else's song
/// overwhelmingly announce it in the title ("Official Audio", "Full Song",
/// a label name). It cannot catch a stolen track under an innocuous title,
/// and it will occasionally suspect a genuine creator whose own song is
/// called "Cover".
///
/// **Which is why a hit warns and never blocks.** On the server a hit files
/// the track for admin review; here in the app it shows the creator what a
/// reviewer is going to see, before they publish, while they can still
/// reword it. A false positive must never stop a real musician publishing
/// their own work, so nothing in this file disables the Publish button.
library;

enum CopyrightRisk { clear, review }

class CopyrightSignal {
  /// Stable id, matching the website's codes so the admin queue can group
  /// and count signals raised from either surface identically.
  final String code;

  /// Written to be read by a human deciding a real person's case.
  final String detail;

  const CopyrightSignal({required this.code, required this.detail});
}

class CopyrightScreening {
  final CopyrightRisk risk;
  final List<CopyrightSignal> signals;

  const CopyrightScreening({required this.risk, required this.signals});

  bool get needsReview => risk == CopyrightRisk.review;
}

class _ReleaseMarker {
  final RegExp pattern;
  final String code;
  final String detail;
  const _ReleaseMarker(this.pattern, this.code, this.detail);
}

/// Phrases that essentially only appear on a re-upload of someone else's
/// commercial release. A creator posting their OWN song does not label it
/// "official audio" — that is the language of a record label's channel.
///
/// Deliberately NOT included: "remix", "mashup", "instrumental", "karaoke".
/// Those are real, common, often perfectly licensed original works, and
/// flagging them would bury the queue in legitimate creators. This is about
/// precision, not coverage — a noisy queue gets ignored, and an ignored
/// queue protects nobody.
final List<_ReleaseMarker> _releaseMarkers = [
  _ReleaseMarker(
    RegExp(r'\bofficial\s+(audio|song|track|music\s*video|video)\b',
        caseSensitive: false),
    'official_release_wording',
    '"Official audio/video" is label wording — creators posting their own song rarely use it.',
  ),
  _ReleaseMarker(
    RegExp(r'\b(lyrical|lyric)\s+video\b', caseSensitive: false),
    'lyrical_video_wording',
    '"Lyrical video" is a standard commercial-release label.',
  ),
  _ReleaseMarker(
    RegExp(r'\bfull\s+(song|audio|movie\s*song|video\s*song)\b',
        caseSensitive: false),
    'full_song_wording',
    '"Full song" is typical of a rip from a commercial release.',
  ),
  _ReleaseMarker(
    RegExp(r'\b(audio\s*jukebox|jukebox)\b', caseSensitive: false),
    'jukebox_wording',
    '"Jukebox" is an album-compilation format published by labels.',
  ),
  _ReleaseMarker(
    RegExp(r'\b(from\s+the\s+(movie|film)|movie\s+song|film\s+version)\b',
        caseSensitive: false),
    'film_soundtrack_wording',
    'Described as being from a film — film soundtracks are owned by the production house or label.',
  ),
  _ReleaseMarker(
    RegExp(
        r'\b(t[\s-]?series|zee\s*music|sony\s*music|saregama|yrf|tips\s*(music|official)|speed\s*records|aditya\s*music|lahari|eros\s*now|universal\s*music|warner\s*music)\b',
        caseSensitive: false),
    'label_named',
    'A record label is named in the metadata. Labels own their masters.',
  ),
  _ReleaseMarker(
    RegExp(r'\b(cover\s+(of|version|song)|sung\s+by\s+me|my\s+cover)\b',
        caseSensitive: false),
    'cover_wording',
    "Described as a cover. A cover of someone else's composition needs a licence even when the performance is original.",
  ),
  _ReleaseMarker(
    // NOTE the shape of this one, carried over from the website verbatim.
    // It was originally written with \b around every alternative, and that
    // could NEVER fire on "©": \b asserts a word/non-word boundary, and © is
    // a non-word character, so \b© demands a word character immediately
    // before the symbol — a string starting "© 2024 Sony" never matched.
    // Word-ish alternatives keep their own \b; the symbol must not have one.
    RegExp(r'(?:\bcopyright\b|©|\(c\)\s*\d{4}|\ball\s+rights\s+reserved\b)',
        caseSensitive: false),
    'copyright_notice',
    'Carries a copyright notice, which usually credits somebody other than the uploader.',
  ),
  _ReleaseMarker(
    RegExp(
        r'\b(no\s+copyright\s+(intended|infringement)|for\s+(promotional|entertainment)\s+purpose)\b',
        caseSensitive: false),
    'disclaimer_wording',
    '"No copyright intended" is an admission, not a defence — it reliably marks a knowing re-upload.',
  ),
];

/// Screens what the creator typed. Never sees or hears the audio.
///
/// `declaredOwnership == false` is on its own enough to send a track to
/// review: if the uploader will not state the song is theirs, nothing else
/// needs deciding.
CopyrightScreening screenMusicMetadata({
  String? title,
  String? description,
  List<String> tags = const [],
  bool declaredOwnership = false,
}) {
  final signals = <CopyrightSignal>[];

  if (!declaredOwnership) {
    signals.add(const CopyrightSignal(
      code: 'ownership_not_declared',
      detail: 'The uploader did not confirm they own this recording.',
    ));
  }

  final parts = <String>[
    if (title != null) title,
    if (description != null) description,
    ...tags,
  ];
  final haystack = parts.join(' \n ');

  if (haystack.trim().isNotEmpty) {
    for (final marker in _releaseMarkers) {
      if (marker.pattern.hasMatch(haystack)) {
        signals.add(CopyrightSignal(code: marker.code, detail: marker.detail));
      }
    }
  }

  return CopyrightScreening(
    risk: signals.isEmpty ? CopyrightRisk.clear : CopyrightRisk.review,
    signals: signals,
  );
}

/// A one-line summary, matching the website's `copyrightSummary`.
String copyrightSummary(CopyrightScreening screening) {
  if (screening.risk == CopyrightRisk.clear) return 'No copyright signals';
  if (screening.signals.length == 1) return screening.signals.first.detail;
  return '${screening.signals.length} copyright signals — ${screening.signals.first.detail}';
}
