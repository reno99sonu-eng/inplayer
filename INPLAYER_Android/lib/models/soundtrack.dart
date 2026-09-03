/// Port of the website's `app/data/soundtracks.ts`.
///
/// The catalogue here is InPlayer's own: every track is 100% original,
/// generated programmatically for the app (synthesized chord loops,
/// arpeggios, drums) — not sampled or licensed from anywhere — so there is
/// zero third-party rights risk. The same eight files are already bundled in
/// this app's `assets/sounds/`, which is what lets the picker preview them
/// without a network round trip while still storing the website-relative URL
/// that playback everywhere else resolves against.
library;

/// Hard playback ceiling for creator-supplied audio — anything with
/// source `custom`, i.e. a file the creator uploaded or a link they pasted.
/// InPlayer has no licence for that audio, so playback never runs past this
/// point: the clip wraps back to 0. 29s deliberately sits just under the
/// ~30s the major platforms settled on for unlicensed music snippets.
///
/// This is a PLAYBACK cap, enforced in the players and re-clamped
/// server-side in `app/api/upload/create/route.ts`, so a hand-crafted
/// request cannot publish a custom track claiming a longer duration.
const int customAudioMaxSeconds = 29;

/// `inplayer` — the local catalogue below, always safe.
/// `jamendo` — a real Creative Commons track found via /api/music/search.
/// `custom` — the creator's own upload or pasted link, capped above.
enum SoundtrackSource { inplayer, jamendo, custom }

extension SoundtrackSourceWire on SoundtrackSource {
  String get wire => switch (this) {
        SoundtrackSource.inplayer => 'inplayer',
        SoundtrackSource.jamendo => 'jamendo',
        SoundtrackSource.custom => 'custom',
      };

  static SoundtrackSource parse(String? raw) => switch (raw) {
        'jamendo' => SoundtrackSource.jamendo,
        'custom' => SoundtrackSource.custom,
        _ => SoundtrackSource.inplayer,
      };
}

/// What actually gets stored on a Short or Video once a track is picked.
///
/// Every field is stored, not just an id — that is deliberate and comes
/// straight from the website: it means an already-published item plays back
/// without ever having to re-look-up an external (Jamendo) track later,
/// which could 404 or change.
class ResolvedSoundtrack {
  final String id;
  final String title;
  final String artist;
  final String url;
  final double durationSeconds;
  final SoundtrackSource source;

  /// Only set for [SoundtrackSource.jamendo] — that track's CC licence page.
  final String? licenseUrl;

  const ResolvedSoundtrack({
    required this.id,
    required this.title,
    required this.artist,
    required this.url,
    required this.durationSeconds,
    required this.source,
    this.licenseUrl,
  });

  factory ResolvedSoundtrack.fromJson(Map<String, dynamic> json) {
    return ResolvedSoundtrack(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Untitled',
      artist: json['artist']?.toString() ?? 'Unknown artist',
      url: json['url']?.toString() ?? '',
      durationSeconds: (json['durationSeconds'] as num?)?.toDouble() ?? 30.0,
      source: SoundtrackSourceWire.parse(json['source']?.toString()),
      licenseUrl: json['licenseUrl']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'artist': artist,
        'url': url,
        'durationSeconds': durationSeconds,
        'source': source.wire,
        if (licenseUrl != null && licenseUrl!.isNotEmpty) 'licenseUrl': licenseUrl,
      };
}

/// One entry in the local catalogue.
class Soundtrack {
  final String id;
  final String title;
  final String artist;
  final String mood;

  /// Website-relative path. Stored as-is so playback resolves it the same
  /// way the site does; the picker previews it from the bundled asset of the
  /// same name instead (see [assetPath]).
  final String url;
  final double durationSeconds;

  const Soundtrack({
    required this.id,
    required this.title,
    required this.artist,
    required this.mood,
    required this.url,
    required this.durationSeconds,
  });

  /// The bundled copy, for preview. `audioplayers`' AssetSource paths are
  /// relative to `assets/`, hence no `assets/` prefix here.
  String get assetPath => 'sounds/$id.mp3';

  ResolvedSoundtrack toResolved() => ResolvedSoundtrack(
        id: id,
        title: title,
        artist: artist,
        url: url,
        durationSeconds: durationSeconds,
        source: SoundtrackSource.inplayer,
      );
}

const List<Soundtrack> kSoundtracks = [
  Soundtrack(id: 'sunset-drive', title: 'Sunset Drive', artist: 'InPlayer Sounds', mood: 'Chill', url: '/sounds/sunset-drive.mp3', durationSeconds: 30),
  Soundtrack(id: 'late-night', title: 'Late Night Loop', artist: 'InPlayer Sounds', mood: 'Chill', url: '/sounds/late-night.mp3', durationSeconds: 30),
  Soundtrack(id: 'morning-coffee', title: 'Morning Coffee', artist: 'InPlayer Sounds', mood: 'Chill', url: '/sounds/morning-coffee.mp3', durationSeconds: 30),
  Soundtrack(id: 'bright-day', title: 'Bright Day', artist: 'InPlayer Sounds', mood: 'Uplifting', url: '/sounds/bright-day.mp3', durationSeconds: 30),
  Soundtrack(id: 'neon-pulse', title: 'Neon Pulse', artist: 'InPlayer Sounds', mood: 'Energetic', url: '/sounds/neon-pulse.mp3', durationSeconds: 30),
  Soundtrack(id: 'cinematic-rise', title: 'Cinematic Rise', artist: 'InPlayer Sounds', mood: 'Cinematic', url: '/sounds/cinematic-rise.mp3', durationSeconds: 30),
  Soundtrack(id: 'groove-street', title: 'Groove Street', artist: 'InPlayer Sounds', mood: 'Groovy', url: '/sounds/groove-street.mp3', durationSeconds: 30),
  Soundtrack(id: 'dreamy-haze', title: 'Dreamy Haze', artist: 'InPlayer Sounds', mood: 'Dreamy', url: '/sounds/dreamy-haze.mp3', durationSeconds: 30),
];

List<Soundtrack> searchSoundtracks(String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return kSoundtracks;
  return kSoundtracks
      .where((t) =>
          t.title.toLowerCase().contains(q) ||
          t.artist.toLowerCase().contains(q) ||
          t.mood.toLowerCase().contains(q))
      .toList();
}

// The "Look" filter (original/warm/vivid/mono) has been removed.
//
// It was write-only in this app: the creator picked a Look, the value was
// uploaded, and nothing in the Android app ever rendered it — only the
// website applies it, via cssFilterFor(). So the chips changed a stored
// value the creator could never see the effect of on their own device.
//
// The server still defaults this to "original" when it is absent, so
// omitting it from the payload is safe and changes nothing for existing
// uploads.

/// The whole picker's value — port of the website's `ShortSettings`.
class ShortSettings {
  final ResolvedSoundtrack? soundtrack;

  /// 20 or 30. Only meaningful for a Short (a fixed-length clip cut short of
  /// the track's natural end); a Video loops the track for its whole
  /// runtime, so the control is hidden there — but the field is still sent,
  /// matching the server, which stores it either way for schema consistency.
  final int musicClipSeconds;

  const ShortSettings({
    this.soundtrack,
    this.musicClipSeconds = 30,
  });

  ShortSettings copyWith({
    ResolvedSoundtrack? soundtrack,
    bool clearSoundtrack = false,
    int? musicClipSeconds,
  }) {
    return ShortSettings(
      soundtrack: clearSoundtrack ? null : (soundtrack ?? this.soundtrack),
      musicClipSeconds: musicClipSeconds ?? this.musicClipSeconds,
    );
  }

  bool get isDefault => soundtrack == null && musicClipSeconds == 30;

  /// Exactly the shape `app/api/upload/create/route.ts` expects under the
  /// `shortSettings` key. It re-sanitizes everything server-side regardless,
  /// but sending the right shape means nothing gets silently dropped.
  Map<String, dynamic> toJson() => {
        'soundtrack': soundtrack?.toJson(),
        'musicClipSeconds': musicClipSeconds == 20 ? 20 : 30,
      };
}

/// How many seconds of a track may play before it wraps back to the start.
///
/// Port of `soundtrackClipSeconds`. Returns null for "no cap, let it loop
/// naturally" — and deliberately does NOT fall back to the item's recorded
/// `durationSeconds` for that case: that field is metadata (Jamendo's own
/// reported length, or a default of 30) and can disagree with the real file,
/// so treating it as a cut-off would start truncating already-published
/// licensed tracks.
double? soundtrackClipSeconds(
  ResolvedSoundtrack? track, [
  double? requestedSeconds,
]) {
  if (track == null) return null;

  var cap = double.infinity;

  if (requestedSeconds != null &&
      requestedSeconds.isFinite &&
      requestedSeconds > 0) {
    cap = requestedSeconds;
  }

  // A custom track is ALWAYS additionally clamped, whatever the creator
  // asked for and whatever duration the item claims.
  if (track.source == SoundtrackSource.custom) {
    cap = cap < customAudioMaxSeconds ? cap : customAudioMaxSeconds.toDouble();
  }

  if (!cap.isFinite) return null;

  if (track.durationSeconds.isFinite && track.durationSeconds > 0) {
    cap = cap < track.durationSeconds ? cap : track.durationSeconds;
  }

  return cap;
}
