// ignore_for_file: deprecated_member_use
import 'dart:async';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:logger/logger.dart';
import 'package:permission_handler/permission_handler.dart';

import '../core/utils/equalizer_store.dart';
import '../core/utils/playback_settings_store.dart';
import '../models/video.dart';
import 'history_service.dart';

class MusicPlayerService extends ChangeNotifier {
  final _logger = Logger();

  /// Android's own equalizer AudioEffect, attached to this player's audio
  /// pipeline.
  ///
  /// It has to be constructed WITH the player — an AudioPipeline cannot be
  /// attached to an AudioPlayer after the fact — so it exists for the life
  /// of the service whether or not anyone ever opens the equalizer screen.
  /// While disabled it is a pass-through and costs nothing.
  ///
  /// If this ever needs backing out, deleting the `audioPipeline:` argument
  /// below returns the player to exactly its previous behaviour; nothing
  /// else in playback reads it.
  final AndroidEqualizer _equalizer = AndroidEqualizer();

  /// `late` because a field initializer cannot reference another instance
  /// field. It is created on first touch, which is inside the constructor
  /// body below, by which point _equalizer exists.
  late final AudioPlayer _player = AudioPlayer(
    audioPipeline: AudioPipeline(androidAudioEffects: [_equalizer]),
  );

  AndroidEqualizer get equalizer => _equalizer;

  final Future<void> Function(String videoId)? onTrackStarted;

  MusicPlayerService({this.onTrackStarted}) {
    _initAudioSession();
    unawaited(_restoreEqualizer());
    _player.currentIndexStream.listen((index) {
      final changed = index != _currentIndex;
      _currentIndex = index;
      notifyListeners();
      final track = currentTrack;
      if (changed && track != null) {
        onTrackStarted?.call(track.videoId);
      }
    });
    _player.playerStateStream.listen((_) => notifyListeners());
  }

  Future<void> _initAudioSession() async {
    try {
      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration.music());
      session.interruptionEventStream.listen((event) {
        if (event.begin) {
          switch (event.type) {
            case AudioInterruptionType.duck:
              _player.setVolume(0.5);
              break;
            case AudioInterruptionType.pause:
            case AudioInterruptionType.unknown:
              _player.pause();
              break;
          }
        } else {
          switch (event.type) {
            case AudioInterruptionType.duck:
              _player.setVolume(1.0);
              break;
            case AudioInterruptionType.pause:
              _player.play();
              break;
            case AudioInterruptionType.unknown:
              break;
          }
        }
      });
      session.becomingNoisyEventStream.listen((_) {
        _player.pause();
      });
    } catch (e) {
      _logger.w('AudioSession configuration warning: $e');
    }
  }

  Future<void> _requestNotificationPermission() async {
    try {
      // Android 13+ requires an explicit runtime grant before the media
      // session notification can appear in the shade/lock screen.
      await Permission.notification.request();
    } catch (_) {}
  }


  // A live, mutable playlist object the player is actually attached to.
  // Queue edits (playNext/addToQueue/removeFromQueue/reorderQueue) mutate
  // THIS object directly via its own add/insert/removeAt methods — that's
  // what lets a track join the queue without interrupting or reloading
  // whatever is currently playing. [playQueue] is the only place that
  // replaces it wholesale (a genuinely new queue, not an edit to this one).
  ConcatenatingAudioSource _playlist = ConcatenatingAudioSource(children: []);

  List<Video> _queue = [];
  int? _currentIndex;

  List<Video> get queue => List.unmodifiable(_queue);
  int? get currentIndex => _currentIndex;
  Video? get currentTrack {
    final i = _currentIndex;
    if (i == null || i < 0 || i >= _queue.length) return null;
    return _queue[i];
  }

  bool get hasTrack => currentTrack != null;
  bool get isPlaying => _player.playing;
  bool get isBuffering =>
      _player.processingState == ProcessingState.loading ||
      _player.processingState == ProcessingState.buffering;
  bool get isShuffled => _player.shuffleModeEnabled;
  LoopMode get loopMode => _player.loopMode;

  Stream<Duration> get positionStream => _player.positionStream;
  Stream<Duration?> get durationStream => _player.durationStream;
  Duration get position => _player.position;
  Duration? get duration => _player.duration;

  /// Cached copy of Settings > Music > Audio quality. Refreshed when a queue
  /// starts rather than watched, so changing it applies from the next queue
  /// instead of yanking the source out from under what is already playing.
  bool _audioDataSaver = false;

  /// Re-applies the saved equalizer settings at startup.
  ///
  /// Deliberately fire-and-forget and fully guarded: `parameters` does not
  /// resolve until the effect has actually attached on the platform side,
  /// which only happens once an audio source is loaded. If no track is ever
  /// played this simply stays pending, which costs nothing — and it must
  /// never be allowed to take playback down with it.
  Future<void> _restoreEqualizer() async {
    try {
      final saved = await EqualizerStore.get();
      if (!saved.enabled) return;
      await _equalizer.setEnabled(true);
      if (saved.gains.isEmpty) return;
      final params = await _equalizer.parameters;
      final bands = params.bands;
      for (var i = 0; i < bands.length && i < saved.gains.length; i++) {
        await bands[i].setGain(saved.gains[i]);
      }
    } catch (e) {
      _logger.w('Could not restore equalizer settings: $e');
    }
  }

  Future<void> _refreshAudioQuality() async {
    try {
      final settings = await PlaybackSettingsStore.get();
      _audioDataSaver = settings.audioQuality.toLowerCase() == 'low';
    } catch (_) {
      // Never block playback on a preference read — keep the last value.
    }
  }

  /// Mux publishes exactly one audio-only static rendition per asset, at a
  /// deterministic URL alongside the adaptive HLS manifest. Data Saver uses
  /// it: for music the video renditions inside the HLS master are pure waste.
  /// There is no lower-bitrate audio variant to choose between, which is why
  /// this is a two-way switch and not a quality ladder.
  String _streamUrlFor(String playbackId) => _audioDataSaver
      ? 'https://stream.mux.com/$playbackId/audio.m4a'
      : 'https://stream.mux.com/$playbackId.m3u8';

  AudioSource _sourceFor(Video track) {
    final playbackId = track.muxPlaybackId ?? '';
    final url = _streamUrlFor(playbackId);
    final coverUrl = track.covers.isNotEmpty ? track.covers.first : track.thumbnail;
    return AudioSource.uri(
      Uri.parse(url),
      tag: MediaItem(
        id: track.videoId,
        title: track.title.isEmpty ? 'Untitled track' : track.title,
        artist: (track.artist?.isNotEmpty == true) ? track.artist : track.creator,
        artUri: coverUrl.isNotEmpty ? Uri.tryParse(coverUrl) : null,
      ),
    );
  }

  /// Starts (or replaces) the queue and plays the track matching
  /// [tracks[startIndex]] immediately. Tracks with no playable stream yet
  /// (still processing — no muxPlaybackId) are skipped rather than failing
  /// the whole queue.
  Future<void> playQueue(List<Video> tracks, {int startIndex = 0}) async {
    final playable = tracks.where((t) => (t.muxPlaybackId ?? '').isNotEmpty).toList();
    if (playable.isEmpty) return;

    await _refreshAudioQuality();

    final requested = startIndex >= 0 && startIndex < tracks.length ? tracks[startIndex] : null;
    var initialIndex = requested != null
        ? playable.indexWhere((t) => t.videoId == requested.videoId)
        : 0;
    if (initialIndex < 0) initialIndex = 0;

    _queue = playable;
    _currentIndex = initialIndex;
    _playlist = ConcatenatingAudioSource(children: playable.map(_sourceFor).toList());
    notifyListeners();

    try {
      _requestNotificationPermission();
      await _player.setAudioSource(_playlist, initialIndex: initialIndex);
      await _player.play();
    } catch (e, stackTrace) {
      _logger.e('Failed to start music queue, retrying playback once', error: e, stackTrace: stackTrace);
      // A transient failure right after loading a new source (e.g. a
      // conflicting AudioPlayer instance elsewhere in the app still
      // mid-teardown) can leave the track fully loaded — title, cover,
      // scrubber all correct — but silently not playing, so the person has
      // to notice and tap Play manually. One retry covers that without
      // requiring them to.
      try {
        // A failure here while Data Saver is on is usually the audio-only
        // rendition missing for this particular asset — nothing else in the
        // app requests that URL. Drop back to the adaptive manifest for this
        // queue rather than leaving the person with silence.
        if (_audioDataSaver) {
          _audioDataSaver = false;
          _playlist = ConcatenatingAudioSource(
            children: playable.map(_sourceFor).toList(),
          );
          await _player.setAudioSource(_playlist, initialIndex: initialIndex);
        }
        await _player.play();
      } catch (e2, stackTrace2) {
        _logger.e('Retry also failed to start music queue', error: e2, stackTrace: stackTrace2);
      }
    }
  }

  /// Plays a single track as a one-track queue — the common case when a
  /// tap doesn't come from a list meant to become the whole queue.
  Future<void> playSingle(Video track) => playQueue([track], startIndex: 0);

  /// Inserts [track] to play immediately after the current one, without
  /// interrupting what's playing now — the standard "Play Next". If
  /// nothing is playing yet, this just starts a fresh single-track queue.
  Future<void> playNext(Video track) async {
    if ((track.muxPlaybackId ?? '').isEmpty) return;
    if (_queue.isEmpty || _currentIndex == null) {
      await playQueue([track]);
      return;
    }
    final insertAt = _currentIndex! + 1;
    try {
      await _playlist.insert(insertAt, _sourceFor(track));
      _queue.insert(insertAt, track);
      notifyListeners();
    } catch (e, stackTrace) {
      _logger.e('Failed to insert track into queue', error: e, stackTrace: stackTrace);
    }
  }

  /// Appends [track] to the end of the current queue — playback keeps
  /// going, the track just joins the back of the line.
  Future<void> addToQueue(Video track) async {
    if ((track.muxPlaybackId ?? '').isEmpty) return;
    if (_queue.isEmpty || _currentIndex == null) {
      await playQueue([track]);
      return;
    }
    try {
      await _playlist.add(_sourceFor(track));
      _queue.add(track);
      notifyListeners();
    } catch (e, stackTrace) {
      _logger.e('Failed to append track to queue', error: e, stackTrace: stackTrace);
    }
  }

  /// Removes the track at [index] from the queue. Deliberately a no-op for
  /// the currently-playing index — removing what's actively loaded mid-
  /// playback is the one queue edit that can visibly hiccup the audio, so
  /// it's simply disallowed rather than risked.
  Future<void> removeFromQueue(int index) async {
    if (index < 0 || index >= _queue.length || index == _currentIndex) return;
    try {
      await _playlist.removeAt(index);
      _queue.removeAt(index);
      if (_currentIndex != null && index < _currentIndex!) {
        _currentIndex = _currentIndex! - 1;
      }
      notifyListeners();
    } catch (e, stackTrace) {
      _logger.e('Failed to remove track from queue', error: e, stackTrace: stackTrace);
    }
  }

  /// Reorders the queue (drag-to-reorder in the Up Next sheet).
  /// [oldIndex]/[newIndex] use Flutter's own `ReorderableListView.onReorder`
  /// convention — this method does the standard newIndex adjustment
  /// internally, so callers can pass the raw callback values through
  /// unchanged. Same restriction as [removeFromQueue]: the currently-
  /// playing track can't be dragged, to avoid disturbing live playback.
  Future<void> reorderQueue(int oldIndex, int newIndex) async {
    if (oldIndex < 0 || oldIndex >= _queue.length || oldIndex == _currentIndex) return;

    var target = newIndex;
    if (oldIndex < target) target -= 1;
    target = target.clamp(0, _queue.length - 1);
    if (target == oldIndex) return;

    final track = _queue[oldIndex];
    final currentTrackId = currentTrack?.videoId;

    try {
      await _playlist.removeAt(oldIndex);
      await _playlist.insert(target, _sourceFor(track));

      _queue.removeAt(oldIndex);
      _queue.insert(target, track);

      if (currentTrackId != null) {
        final idx = _queue.indexWhere((t) => t.videoId == currentTrackId);
        if (idx >= 0) _currentIndex = idx;
      }
      notifyListeners();
    } catch (e, stackTrace) {
      _logger.e('Failed to reorder queue', error: e, stackTrace: stackTrace);
    }
  }

  Future<void> togglePlayPause() async {
    if (currentTrack == null) return;
    if (_player.playing) {
      await _player.pause();
    } else {
      await _player.play();
    }
  }

  Future<void> seek(Duration position) => _player.seek(position);

  Future<void> next() async {
    if (_queue.isEmpty || _currentIndex == null) return;
    final nextIndex = _currentIndex! + 1;
    if (nextIndex < _queue.length) {
      await _player.seek(Duration.zero, index: nextIndex);
      await _player.play();
    } else if (_player.loopMode == LoopMode.all) {
      await _player.seek(Duration.zero, index: 0);
      await _player.play();
    }
  }

  /// Restarts the current track if more than 5s in (the near-universal
  /// "previous" behavior); otherwise goes back one track.
  Future<void> previous() async {
    if (_queue.isEmpty || _currentIndex == null) return;
    if (_player.position > const Duration(seconds: 5) || _currentIndex! <= 0) {
      await _player.seek(Duration.zero);
      return;
    }
    await _player.seek(Duration.zero, index: _currentIndex! - 1);
    await _player.play();
  }

  /// Jumps to [index] within the CURRENT queue (used by the queue sheet) —
  /// distinct from [playQueue], which replaces the queue entirely.
  Future<void> jumpTo(int index) async {
    if (index < 0 || index >= _queue.length) return;
    await _player.seek(Duration.zero, index: index);
    await _player.play();
  }

  Future<void> toggleShuffle() async {
    final next = !_player.shuffleModeEnabled;
    if (next) await _player.shuffle();
    await _player.setShuffleModeEnabled(next);
    notifyListeners();
  }

  Future<void> cycleRepeatMode() async {
    final next = switch (_player.loopMode) {
      LoopMode.off => LoopMode.all,
      LoopMode.all => LoopMode.one,
      LoopMode.one => LoopMode.off,
    };
    await _player.setLoopMode(next);
    notifyListeners();
  }

  double get speed => _player.speed;

  Future<void> setSpeed(double speed) async {
    await _player.setSpeed(speed);
    notifyListeners();
  }

  Future<void> stop() async {
    await _player.stop();
    _queue = [];
    _currentIndex = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }
}

final musicPlayerServiceProvider = ChangeNotifierProvider<MusicPlayerService>((ref) {
  final service = MusicPlayerService(
    onTrackStarted: (videoId) => ref.read(historyServiceProvider).recordWatch(videoId),
  );
  ref.onDispose(service.dispose);
  return service;
});
