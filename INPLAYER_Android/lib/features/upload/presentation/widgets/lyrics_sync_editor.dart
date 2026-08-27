import 'dart:async';
import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/music_track_utils.dart';
import '../../../../models/lyric_line.dart';

/// Lines the creator hasn't stamped yet inherit the timestamp of the last one
/// they did. Ported from the website's `cascadeTimes` — and the fallback is
/// deliberately the previous stamp rather than 0, for two reasons:
///
///   - **Order survives.** `sanitizeLyrics` on the server sorts by time, and
///     that sort is stable, so a block of tied lines keeps the order it was
///     written in. Leaving them at 0 would float the whole untimed tail of
///     the song to the top of the lyric sheet.
///   - **It reads correctly.** An unsynced block appears the moment the last
///     synced line does and stays up — exactly what a listener should see
///     when the creator stopped tapping halfway.
List<LyricLine> cascadeTimes(List<String> texts, List<double?> stamps) {
  var last = 0.0;
  final out = <LyricLine>[];
  for (var i = 0; i < texts.length; i++) {
    final t = i < stamps.length ? stamps[i] : null;
    if (t != null && t.isFinite) last = t;
    out.add(LyricLine(time: last, text: texts[i]));
  }
  return out;
}

/// Renders timed lines back to LRC, so switching to paste mode after
/// stamping doesn't throw the timings away.
String toLrc(List<LyricLine> lines) {
  return lines.map((l) {
    final total = l.time;
    final minutes = total ~/ 60;
    final seconds = total - minutes * 60;
    final mm = minutes.toString().padLeft(2, '0');
    final ss = seconds.toStringAsFixed(2).padLeft(5, '0');
    return '[$mm:$ss]${l.text}';
  }).join('\n');
}

/// Tap-to-stamp synced lyrics editor.
///
/// The app's counterpart to the lyrics half of the website's
/// MusicUploadTools.tsx. Timing is done by ear against the real audio file —
/// the creator plays the track and taps once per line — rather than by
/// automatic alignment, which needs a transcript the platform doesn't have
/// and gets subtly wrong in ways that are worse than untimed lyrics.
///
/// Returns the finished lines, or null if dismissed without saving.
Future<List<LyricLine>?> showLyricsSyncEditor(
  BuildContext context, {
  required String audioFilePath,
  List<LyricLine> initialLines = const [],
  String initialRawText = '',
}) {
  return showModalBottomSheet<List<LyricLine>>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _LyricsSyncEditor(
      audioFilePath: audioFilePath,
      initialLines: initialLines,
      initialRawText: initialRawText,
    ),
  );
}

class _LyricsSyncEditor extends StatefulWidget {
  final String audioFilePath;
  final List<LyricLine> initialLines;
  final String initialRawText;

  const _LyricsSyncEditor({
    required this.audioFilePath,
    required this.initialLines,
    required this.initialRawText,
  });

  @override
  State<_LyricsSyncEditor> createState() => _LyricsSyncEditorState();
}

class _LyricsSyncEditorState extends State<_LyricsSyncEditor> {
  // audioplayers, not just_audio, and this is not a style preference:
  // just_audio_background enforces a single AudioPlayer instance app-wide
  // once initialised (see main.dart), and MusicPlayerService already owns
  // that one. A second just_audio player here would throw on construction —
  // the exact crash Round 24 spent a whole round tracking down.
  AudioPlayer? _player;
  StreamSubscription<Duration>? _posSub;
  StreamSubscription<Duration>? _durSub;
  StreamSubscription<void>? _completeSub;

  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _playing = false;
  bool _audioReady = false;

  /// `_texts` is the words in the creator's order; `_stamps` is a parallel
  /// list where null means "not stamped yet". Kept apart rather than as one
  /// list of LyricLine so an unstamped line is genuinely distinguishable
  /// from one stamped at 0:00.
  List<String> _texts = [];
  List<double?> _stamps = [];

  /// Which line the big Stamp button will time next.
  int _cursor = 0;

  bool _pasteMode = true;
  late final TextEditingController _pasteCtrl;

  @override
  void initState() {
    super.initState();

    // Seed from whatever already exists: previously synced lines win, then
    // the plain-text field's contents, then empty.
    if (widget.initialLines.isNotEmpty) {
      _texts = widget.initialLines.map((l) => l.text).toList();
      final anyTimed = widget.initialLines.any((l) => l.time > 0);
      _stamps = widget.initialLines
          .map<double?>((l) => anyTimed ? l.time : null)
          .toList();
      _cursor = anyTimed ? _texts.length : 0;
      _pasteMode = false;
    }
    _pasteCtrl = TextEditingController(
      text: widget.initialLines.isNotEmpty
          ? toLrc(widget.initialLines)
          : widget.initialRawText,
    );

    _initAudio();
  }

  Future<void> _initAudio() async {
    try {
      final file = File(widget.audioFilePath);
      if (!await file.exists()) return;
      final player = AudioPlayer();
      await player.setSourceDeviceFile(widget.audioFilePath);
      if (!mounted) {
        await player.dispose();
        return;
      }
      _posSub = player.onPositionChanged.listen((p) {
        if (mounted) setState(() => _position = p);
      });
      _durSub = player.onDurationChanged.listen((d) {
        if (mounted) setState(() => _duration = d);
      });
      _completeSub = player.onPlayerComplete.listen((_) {
        if (mounted) setState(() => _playing = false);
      });
      setState(() {
        _player = player;
        _audioReady = true;
      });
    } catch (_) {
      // Preview audio is a convenience, not a requirement — the editor still
      // works for pasting and hand-editing without it.
    }
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _durSub?.cancel();
    _completeSub?.cancel();
    _player?.dispose();
    _pasteCtrl.dispose();
    super.dispose();
  }

  double get _seconds => _position.inMilliseconds / 1000.0;

  Future<void> _togglePlay() async {
    final p = _player;
    if (p == null) return;
    if (_playing) {
      await p.pause();
    } else {
      await p.resume();
    }
    if (mounted) setState(() => _playing = !_playing);
  }

  Future<void> _seek(double seconds) async {
    final p = _player;
    if (p == null) return;
    final target = Duration(milliseconds: (seconds * 1000).round().clamp(0, 1 << 31));
    await p.seek(target);
    if (mounted) setState(() => _position = target);
  }

  void _loadPasted() {
    final parsed = parseLyrics(_pasteCtrl.text);
    if (parsed.isEmpty) {
      setState(() => _pasteMode = true);
      return;
    }
    // An LRC paste arrives already timed; plain text arrives all-zero. If
    // anything carries a real timestamp, trust the file and treat every line
    // as stamped — otherwise start the creator at line 1.
    final alreadyTimed = parsed.any((l) => l.time > 0);
    setState(() {
      _texts = parsed.map((l) => l.text).toList();
      _stamps = parsed.map<double?>((l) => alreadyTimed ? l.time : null).toList();
      _cursor = alreadyTimed ? _texts.length : 0;
      _pasteMode = false;
    });
  }

  void _backToPaste() {
    setState(() {
      _pasteCtrl.text = _stamps.any((s) => s != null)
          ? toLrc(cascadeTimes(_texts, _stamps))
          : _texts.join('\n');
      _pasteMode = true;
    });
  }

  void _stampLine(int index, [double? at]) {
    if (index < 0 || index >= _texts.length) return;
    final t = at ?? _seconds;
    setState(() {
      _stamps[index] = (t * 100).round() / 100.0;
      if (_stamps[index]! < 0) _stamps[index] = 0;
      if (index >= _cursor) _cursor = index + 1;
    });
  }

  void _nudge(int index, double delta) {
    final current = _stamps[index];
    if (current == null) return;
    setState(() {
      final next = ((current + delta) * 100).round() / 100.0;
      _stamps[index] = next < 0 ? 0 : next;
    });
  }

  void _clearTimings() {
    setState(() {
      _stamps = List<double?>.filled(_texts.length, null);
      _cursor = 0;
    });
  }

  String _fmt(double seconds) {
    if (seconds < 0) return '0:00';
    final m = seconds ~/ 60;
    final s = (seconds - m * 60);
    return '$m:${s.toStringAsFixed(1).padLeft(4, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF08111F) : const Color(0xFFF5EEDC),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.22)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildHandle(context),
          _buildHeader(context),
          if (_audioReady) _buildPlayerBar(context),
          const Divider(height: 1),
          Flexible(
            child: _pasteMode ? _buildPasteMode(context) : _buildSyncMode(context),
          ),
          _buildFooter(context),
        ],
      ),
    );
  }

  Widget _buildHandle(BuildContext context) => Container(
        width: 40,
        height: 4,
        margin: const EdgeInsets.only(top: 10, bottom: 10),
        decoration: BoxDecoration(
          color: context.textSecondary.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(2),
        ),
      );

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 8, 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Synced lyrics',
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  _pasteMode
                      ? 'Paste your lyrics — plain text or an .lrc file.'
                      : 'Play the track and tap Stamp on each line as it starts.',
                  style: TextStyle(color: context.textDim, fontSize: 11.5),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: Icon(Icons.close_rounded, color: context.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildPlayerBar(BuildContext context) {
    final dur = _duration.inMilliseconds / 1000.0;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Row(
        children: [
          GestureDetector(
            onTap: _togglePlay,
            child: Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: AppColors.brandOrange,
                shape: BoxShape.circle,
              ),
              child: Icon(
                _playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                color: Colors.black,
                size: 22,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            _fmt(_seconds),
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w800,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          Expanded(
            child: Slider(
              value: dur > 0 ? _seconds.clamp(0, dur) : 0,
              max: dur > 0 ? dur : 1,
              activeColor: AppColors.brandOrange,
              onChanged: dur > 0 ? (v) => _seek(v) : null,
            ),
          ),
          Text(
            _fmt(dur),
            style: TextStyle(color: context.textDim, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildPasteMode(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _pasteCtrl,
            maxLines: 12,
            minLines: 8,
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 13,
              height: 1.5,
            ),
            decoration: InputDecoration(
              hintText: 'One line per lyric line.\n\n'
                  'Already have an .lrc? Paste it with its [mm:ss.xx] tags '
                  'and the timings come across too.',
              hintStyle: TextStyle(
                color: context.textSecondary.withValues(alpha: 0.65),
                fontSize: 12.5,
                height: 1.5,
              ),
              filled: true,
              fillColor: context.textPrimary.withValues(alpha: 0.03),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: context.borderSubtle),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: context.borderSubtle),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loadPasted,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brandOrange,
                foregroundColor: Colors.black87,
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text(
                'Load lines',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSyncMode(BuildContext context) {
    if (_texts.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(32),
        child: Center(
          child: Text(
            'No lines yet.',
            style: TextStyle(color: context.textDim),
          ),
        ),
      );
    }

    final publishable = cascadeTimes(_texts, _stamps);
    final liveIndex = _playing || _seconds > 0
        ? activeLyricIndex(publishable, _seconds)
        : -1;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // The big target. Deliberately one large button rather than asking
        // the creator to hit a small per-row control while the song plays —
        // the whole interaction is "listen, tap on the beat", and a 44px row
        // button makes that miss.
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _cursor < _texts.length
                  ? () => _stampLine(_cursor)
                  : null,
              icon: const Icon(Icons.touch_app_rounded, size: 18),
              label: Text(
                _cursor < _texts.length
                    ? 'Stamp line ${_cursor + 1} at ${_fmt(_seconds)}'
                    : 'All lines stamped',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brandOrange,
                foregroundColor: Colors.black87,
                disabledBackgroundColor:
                    AppColors.brandOrange.withValues(alpha: 0.25),
                padding: const EdgeInsets.symmetric(vertical: 15),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ),
        Flexible(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(10, 4, 10, 10),
            itemCount: _texts.length,
            itemBuilder: (context, i) => _buildLineRow(context, i, liveIndex),
          ),
        ),
      ],
    );
  }

  Widget _buildLineRow(BuildContext context, int i, int liveIndex) {
    final stamp = _stamps[i];
    final isNext = i == _cursor;
    final isLive = i == liveIndex;

    return Container(
      margin: const EdgeInsets.only(bottom: 5),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: isNext
            ? AppColors.brandOrange.withValues(alpha: 0.12)
            : isLive
                ? context.textPrimary.withValues(alpha: 0.05)
                : Colors.transparent,
        borderRadius: BorderRadius.circular(11),
        border: Border.all(
          color: isNext
              ? AppColors.brandOrange.withValues(alpha: 0.4)
              : Colors.transparent,
        ),
      ),
      child: Row(
        children: [
          // Tapping the timestamp seeks there — the fastest way to check a
          // stamp landed on the right beat is to jump to it and listen.
          GestureDetector(
            onTap: stamp != null ? () => _seek(stamp) : null,
            child: SizedBox(
              width: 52,
              child: Text(
                stamp != null ? _fmt(stamp) : '—',
                style: TextStyle(
                  color: stamp != null
                      ? AppColors.brandOrangeLight
                      : context.textDim.withValues(alpha: 0.6),
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ),
          Expanded(
            child: Text(
              _texts[i],
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: isLive ? context.textPrimary : context.textSecondary,
                fontSize: 13,
                fontWeight: isLive ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
          if (stamp != null) ...[
            _tinyButton(Icons.remove_rounded, () => _nudge(i, -0.1)),
            _tinyButton(Icons.add_rounded, () => _nudge(i, 0.1)),
          ],
          _tinyButton(Icons.my_location_rounded, () => _stampLine(i)),
        ],
      ),
    );
  }

  Widget _tinyButton(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Icon(icon, size: 15, color: context.textSecondary),
      ),
    );
  }

  Widget _buildFooter(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
        child: Row(
          children: [
            if (!_pasteMode) ...[
              TextButton(
                onPressed: _backToPaste,
                child: Text('Edit text',
                    style: TextStyle(color: context.textSecondary, fontSize: 12)),
              ),
              TextButton(
                onPressed: _stamps.any((s) => s != null) ? _clearTimings : null,
                child: const Text('Clear timings',
                    style: TextStyle(fontSize: 12)),
              ),
            ],
            const Spacer(),
            ElevatedButton(
              onPressed: () {
                // Empty is a valid answer — it means "no lyrics", and the
                // caller treats an empty list exactly that way.
                Navigator.of(context).pop(
                  _texts.isEmpty
                      ? <LyricLine>[]
                      : cascadeTimes(_texts, _stamps),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brandOrange,
                foregroundColor: Colors.black87,
                padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(13),
                ),
              ),
              child: const Text('Done',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
