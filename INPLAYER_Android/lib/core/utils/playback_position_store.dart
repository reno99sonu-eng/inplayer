import 'package:shared_preferences/shared_preferences.dart';

/// Mirrors the website's "Remember playback position" behavior
/// (VideoPlayer.tsx's `savePlaybackPosition`/`getPlaybackPosition`/
/// `clearPlaybackPosition`, which write to `localStorage`). There's no
/// backend endpoint for this — it's genuinely a local-only, per-device
/// preference on the website too — so `shared_preferences` is the correct
/// direct equivalent of localStorage here, not a shortcut.
///
/// Key shape matches the website's own convention closely enough to be
/// recognizable (`inplayer:playback-position:<videoId>`) even though the
/// two storages are never actually shared (native app vs. browser).
class PlaybackPositionStore {
  PlaybackPositionStore._();

  static const _keyPrefix = 'inplayer:playback-position:';
  static String _key(String videoId) => '$_keyPrefix$videoId';

  // Matches app/lib/playbackPositions.ts exactly (MIN_SAVE_SECONDS /
  // END_THRESHOLD_SECONDS) — this was approximated (3s / 5s) before the
  // real website file backing "Remember playback position" was read.
  // Below MIN_SAVE_SECONDS, resuming is more annoying than helpful; within
  // END_THRESHOLD_SECONDS of the end, the video is finished.
  static const _minSaveSeconds = 15;
  static const _endThresholdSeconds = 20;

  /// Saves a position in seconds. Silently does nothing for a video with
  /// no real duration yet, or a position that isn't meaningfully into the
  /// video (matches the website only bothering to persist once playback
  /// is actually underway).
  static Future<void> save(String videoId, double positionSeconds, double durationSeconds) async {
    if (videoId.isEmpty) return;
    if (!positionSeconds.isFinite || positionSeconds < _minSaveSeconds) return;
    // Finished (or as good as) — drop any stored point so the next open
    // starts cleanly instead of resuming into the credits.
    if (durationSeconds.isFinite &&
        durationSeconds > 0 &&
        positionSeconds >= durationSeconds - _endThresholdSeconds) {
      await clear(videoId);
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_key(videoId), positionSeconds);
  }

  /// Returns the saved position in seconds, or null if none is stored.
  static Future<double?> get(String videoId) async {
    if (videoId.isEmpty) return null;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getDouble(_key(videoId));
  }

  static Future<void> clear(String videoId) async {
    if (videoId.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(videoId));
  }

  /// Called when "Remember playback position" is switched off in Settings —
  /// "off" has to mean previously saved points stop resuming too, not
  /// merely that no new ones are added. Matches the website's own
  /// clearAllPlaybackPositions() (app/lib/playbackPositions.ts).
  static Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys().where((k) => k.startsWith(_keyPrefix)).toList();
    for (final key in keys) {
      await prefs.remove(key);
    }
  }
}
