import 'dart:async';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/soundtrack.dart';
import '../../../../services/soundtrack_service.dart';

/// Soundtrack picker, clip length and Look filter — the app's counterpart to
/// the website's `ShortCreationTools.tsx`.
///
/// Two catalogues feed the same picker: InPlayer's own local instrumentals
/// (100% synthesized, no licensing involved at all) and a live search
/// against real Creative Commons music via Jamendo. Whichever is chosen is
/// stored in full — id, title, artist, url, duration, source — not just an
/// id, so playback never has to re-look-up an external track later.
///
/// Originally Shorts-only on the website, now offered for Video uploads too;
/// the clip-length control is the one piece that stays Shorts-only, because
/// a Video loops the track for its whole runtime instead of cutting it.
class ShortCreationTools extends ConsumerStatefulWidget {
  final ShortSettings value;
  final ValueChanged<ShortSettings> onChanged;

  /// 'video' | 'short' | 'music'
  final String contentType;

  const ShortCreationTools({
    super.key,
    required this.value,
    required this.onChanged,
    required this.contentType,
  });

  @override
  ConsumerState<ShortCreationTools> createState() => _ShortCreationToolsState();
}

class _ShortCreationToolsState extends ConsumerState<ShortCreationTools> {
  // 0 = InPlayer catalogue, 1 = search real music, 2 = own link
  int _tab = 0;

  final _searchCtrl = TextEditingController();
  final _linkCtrl = TextEditingController();

  List<ResolvedSoundtrack> _results = const [];
  bool _searching = false;
  String? _searchError;
  Timer? _debounce;

  // audioplayers, not just_audio — see the note in lyrics_sync_editor.dart:
  // just_audio_background allows exactly one AudioPlayer app-wide and
  // MusicPlayerService owns it.
  AudioPlayer? _preview;
  String? _previewingId;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    _linkCtrl.dispose();
    _preview?.dispose();
    super.dispose();
  }

  void _onSearchChanged(String q) {
    _debounce?.cancel();
    if (q.trim().isEmpty) {
      setState(() {
        _results = const [];
        _searchError = null;
        _searching = false;
      });
      return;
    }
    // Debounced rather than per-keystroke: each of these is a real round
    // trip out to Jamendo through the site.
    _debounce = Timer(const Duration(milliseconds: 450), () => _runSearch(q));
  }

  Future<void> _runSearch(String q) async {
    setState(() {
      _searching = true;
      _searchError = null;
    });
    try {
      final tracks = await ref.read(soundtrackServiceProvider).search(q);
      if (!mounted) return;
      setState(() {
        _results = tracks;
        _searching = false;
      });
    } on SoundtrackSearchException catch (e) {
      if (!mounted) return;
      setState(() {
        _searchError = e.message;
        _searching = false;
      });
    }
  }

  Future<void> _togglePreview(String id, Source source) async {
    final player = _preview ??= AudioPlayer();
    if (_previewingId == id) {
      await player.stop();
      if (mounted) setState(() => _previewingId = null);
      return;
    }
    try {
      await player.stop();
      await player.play(source);
      if (mounted) setState(() => _previewingId = id);
    } catch (_) {
      if (mounted) setState(() => _previewingId = null);
    }
  }

  void _pick(ResolvedSoundtrack? track) {
    widget.onChanged(track == null
        ? widget.value.copyWith(clearSoundtrack: true)
        : widget.value.copyWith(soundtrack: track));
  }

  @override
  Widget build(BuildContext context) {
    final selected = widget.value.soundtrack;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel(context, 'Soundtrack'),
        if (selected != null) _buildSelected(context, selected),
        const SizedBox(height: 8),
        _buildTabs(context),
        const SizedBox(height: 10),
        if (_tab == 0) _buildLocalCatalogue(context),
        if (_tab == 1) _buildSearch(context),
        if (_tab == 2) _buildCustomLink(context),
        if (_tab == 3) _buildLocalAudioPicker(context),

        // Clip length is meaningless for a Video (it loops the track for the
        // whole runtime) and for music, so it only appears for a Short —
        // matching the website exactly.
        if (widget.contentType == 'short' && selected != null) ...[
          _sectionLabel(context, 'Music clip length'),
          Row(
            children: [
              _clipChip(context, 20),
              const SizedBox(width: 8),
              _clipChip(context, 30),
            ],
          ),
        ],

        _sectionLabel(context, 'Look'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: LookFilter.values
              .map((f) => _lookChip(context, f))
              .toList(),
        ),
        const SizedBox(height: 4),
      ],
    );
  }

  Widget _sectionLabel(BuildContext context, String text) => Padding(
        padding: const EdgeInsets.only(top: 14, bottom: 6),
        child: Text(
          text,
          style: TextStyle(
            color: context.textSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      );

  Widget _buildSelected(BuildContext context, ResolvedSoundtrack t) {
    final capped = t.source == SoundtrackSource.custom;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.brandOrange.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          const Icon(Icons.music_note_rounded,
              size: 16, color: AppColors.brandOrangeLight),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  capped
                      // Said plainly rather than buried: this is a licensing
                      // limit, and a creator who doesn't know about it will
                      // think their audio is broken.
                      ? '${t.artist} · your own audio, capped at ${customAudioMaxSeconds}s'
                      : t.artist,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: context.textDim, fontSize: 11),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => _pick(null),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Icon(Icons.close_rounded,
                  size: 16, color: context.textSecondary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabs(BuildContext context) {
    const labels = ['InPlayer', 'Search music', 'Your link', 'Upload (29s)'];
    return Row(
      children: List.generate(labels.length, (i) {
        final active = _tab == i;
        return Expanded(
          child: GestureDetector(
            onTap: () => setState(() => _tab = i),
            child: Container(
              margin: EdgeInsets.only(right: i < labels.length - 1 ? 4 : 0),
              padding: const EdgeInsets.symmetric(vertical: 7),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active
                    ? AppColors.brandOrange.withValues(alpha: 0.15)
                    : context.textPrimary.withValues(alpha: 0.03),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: active
                      ? AppColors.brandOrange.withValues(alpha: 0.4)
                      : context.borderSubtle,
                ),
              ),
              child: Text(
                labels[i],
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: active
                      ? AppColors.brandOrangeLight
                      : context.textSecondary,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildLocalCatalogue(BuildContext context) {
    return Column(
      children: kSoundtracks.map((t) {
        final isSelected = widget.value.soundtrack?.id == t.id;
        return _trackRow(
          context,
          title: t.title,
          subtitle: '${t.artist} · ${t.mood}',
          selected: isSelected,
          previewing: _previewingId == t.id,
          // Previewed from the bundled asset rather than the network: the
          // same eight files already ship in assets/sounds/, so this is
          // instant and works offline.
          onPreview: () => _togglePreview(t.id, AssetSource(t.assetPath)),
          onPick: () => _pick(t.toResolved()),
        );
      }).toList(),
    );
  }

  Widget _buildSearch(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _searchCtrl,
          onChanged: _onSearchChanged,
          style: TextStyle(color: context.textPrimary, fontSize: 13),
          decoration: InputDecoration(
            hintText: 'Search real Creative Commons music…',
            hintStyle: TextStyle(color: context.textDim, fontSize: 12.5),
            prefixIcon: Icon(Icons.search_rounded,
                size: 18, color: context.textSecondary),
            isDense: true,
            filled: true,
            fillColor: context.textPrimary.withValues(alpha: 0.03),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: context.borderSubtle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: context.borderSubtle),
            ),
          ),
        ),
        const SizedBox(height: 8),
        if (_searching)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: Center(
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: AppColors.brandOrange),
              ),
            ),
          )
        else if (_searchError != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(_searchError!,
                style: const TextStyle(color: Color(0xFFF87171), fontSize: 11.5)),
          )
        else if (_results.isEmpty && _searchCtrl.text.trim().isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text('No tracks found.',
                style: TextStyle(color: context.textDim, fontSize: 11.5)),
          )
        else
          ..._results.map(
            (t) => _trackRow(
              context,
              title: t.title,
              subtitle: t.artist,
              selected: widget.value.soundtrack?.id == t.id,
              previewing: _previewingId == t.id,
              onPreview: () => _togglePreview(t.id, UrlSource(t.url)),
              onPick: () => _pick(t),
            ),
          ),
        if (_results.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              'Creative Commons tracks, licensed for commercial use by their '
              'own terms. Credit the artist in your description.',
              style: TextStyle(color: context.textDim, fontSize: 10.5, height: 1.4),
            ),
          ),
      ],
    );
  }

  Widget _buildCustomLink(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _linkCtrl,
          keyboardType: TextInputType.url,
          style: TextStyle(color: context.textPrimary, fontSize: 13),
          decoration: InputDecoration(
            hintText: 'https://…  direct link to an audio file',
            hintStyle: TextStyle(color: context.textDim, fontSize: 12.5),
            isDense: true,
            filled: true,
            fillColor: context.textPrimary.withValues(alpha: 0.03),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: context.borderSubtle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: context.borderSubtle),
            ),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: () {
              final track = ref
                  .read(soundtrackServiceProvider)
                  .fromCustomUrl(_linkCtrl.text);
              if (track == null) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('That does not look like a valid http(s) link.')),
                );
                return;
              }
              _pick(track);
            },
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: AppColors.brandOrange.withValues(alpha: 0.5)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Use this audio',
                style: TextStyle(
                    color: AppColors.brandOrange, fontWeight: FontWeight.bold)),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'InPlayer has no licence for audio you supply, so playback is '
          'capped at ${customAudioMaxSeconds}s and wraps back to the start. '
          'Only use audio you have the right to use.',
          style: TextStyle(color: context.textDim, fontSize: 10.5, height: 1.4),
        ),
      ],
    );
  }

  Widget _buildLocalAudioPicker(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () async {
            try {
              final result = await FilePicker.platform.pickFiles(
                type: FileType.custom,
                allowedExtensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'],
              );
              if (result != null && result.files.single.path != null) {
                final file = File(result.files.single.path!);
                final name = result.files.single.name;
                final track = ResolvedSoundtrack(
                  id: 'local_${DateTime.now().millisecondsSinceEpoch}',
                  title: name.replaceAll(RegExp(r'\.[a-zA-Z0-9]+$'), ''),
                  artist: 'Your device audio',
                  url: file.uri.toString(),
                  durationSeconds: customAudioMaxSeconds.toDouble(),
                  source: SoundtrackSource.custom,
                );
                _pick(track);
              }
            } catch (e) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed to pick audio: $e')),
                );
              }
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
            decoration: BoxDecoration(
              color: context.bgCard,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.brandOrange.withValues(alpha: 0.4),
                style: BorderStyle.solid,
                width: 1.5,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.audio_file_rounded, color: AppColors.brandOrange, size: 24),
                const SizedBox(width: 12),
                Text(
                  'Choose Audio file from device (29s max)',
                  style: TextStyle(
                    color: context.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Upload your own voiceover or sound (capped at 29s per InPlayer terms).',
          style: TextStyle(color: context.textDim, fontSize: 10.5, height: 1.4),
        ),
      ],
    );
  }

  Widget _trackRow(
    BuildContext context, {
    required String title,
    required String subtitle,
    required bool selected,
    required bool previewing,
    required VoidCallback onPreview,
    required VoidCallback onPick,
  }) {
    return GestureDetector(
      onTap: onPick,
      behavior: HitTestBehavior.opaque,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.brandOrange.withValues(alpha: 0.10)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(11),
          border: Border.all(
            color: selected
                ? AppColors.brandOrange.withValues(alpha: 0.4)
                : context.borderSubtle,
          ),
        ),
        child: Row(
          children: [
            GestureDetector(
              onTap: onPreview,
              child: Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: context.textPrimary.withValues(alpha: 0.06),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  previewing ? Icons.stop_rounded : Icons.play_arrow_rounded,
                  size: 17,
                  color: context.textPrimary,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: context.textDim, fontSize: 10.5),
                  ),
                ],
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle_rounded,
                  size: 17, color: AppColors.brandOrange),
          ],
        ),
      ),
    );
  }

  Widget _clipChip(BuildContext context, int seconds) {
    final active = widget.value.musicClipSeconds == seconds;
    return GestureDetector(
      onTap: () => widget.onChanged(
          widget.value.copyWith(musicClipSeconds: seconds)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: active
              ? AppColors.brandOrange.withValues(alpha: 0.15)
              : context.textPrimary.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active
                ? AppColors.brandOrange.withValues(alpha: 0.45)
                : context.borderSubtle,
          ),
        ),
        child: Text(
          '${seconds}s',
          style: TextStyle(
            color: active ? AppColors.brandOrangeLight : context.textSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }

  Widget _lookChip(BuildContext context, LookFilter f) {
    final active = widget.value.filter == f;
    return GestureDetector(
      onTap: () => widget.onChanged(widget.value.copyWith(filter: f)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: active
              ? AppColors.brandOrange.withValues(alpha: 0.15)
              : context.textPrimary.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active
                ? AppColors.brandOrange.withValues(alpha: 0.45)
                : context.borderSubtle,
          ),
        ),
        child: Text(
          f.label,
          style: TextStyle(
            color: active ? AppColors.brandOrangeLight : context.textSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}
