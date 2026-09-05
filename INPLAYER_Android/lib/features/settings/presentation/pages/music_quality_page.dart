import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/music_settings_store.dart';
import '../../../../services/music_player_service.dart';

/// Streaming quality for music, chosen separately for Wi-Fi and mobile
/// data — the only place the choice has any consequence.
///
/// There are two levels rather than a ladder, and that is a fact about the
/// files, not a simplification. Mux publishes exactly one audio-only static
/// rendition per asset at a deterministic URL beside the adaptive HLS
/// manifest (verified against Mux's static-rendition guide:
/// `stream.mux.com/{id}/audio.m4a`, no bitrate variants). So the real
/// decision is "full adaptive stream" or "the audio-only file", and
/// inventing Low / Normal / Very High rows on top of that would be four
/// labels pointing at two files.
class MusicQualityPage extends ConsumerStatefulWidget {
  const MusicQualityPage({super.key});

  @override
  ConsumerState<MusicQualityPage> createState() => _MusicQualityPageState();
}

class _MusicQualityPageState extends ConsumerState<MusicQualityPage> {
  MusicSettings _settings = const MusicSettings();
  bool _loaded = false;

  static const _choices = [
    (
      MusicSettings.qualityHigh,
      'High',
      'Full adaptive stream. Best on Wi-Fi.',
    ),
    (
      MusicSettings.qualitySaver,
      'Data Saver',
      'Audio only — skips the video part of the stream and uses far less '
          'data.',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final settings = await MusicSettingsStore.get();
    if (!mounted) return;
    setState(() {
      _settings = settings;
      _loaded = true;
    });
  }

  Future<void> _update(MusicSettings Function(MusicSettings) patch) async {
    final next = patch(_settings);
    setState(() => _settings = next);
    await MusicSettingsStore.save(next);
    await ref.read(musicPlayerServiceProvider).applyMusicSettings(next);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        foregroundColor: context.textPrimary,
        elevation: 0,
        title: Text(
          'Media quality',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: context.textPrimary,
            fontSize: 20,
          ),
        ),
      ),
      body: !_loaded
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
              children: [
                _pageHeader('Audio streaming quality'),
                _note(
                  'Quality changes on the next track, not the one already '
                  'playing.',
                ),
                const SizedBox(height: 14),
                _groupLabel('Wi-Fi streaming quality'),
                _groupCaption(
                  'Used whenever the phone is on Wi-Fi.',
                ),
                const SizedBox(height: 8),
                _card(
                  children: [
                    for (final choice in _choices)
                      _radioRow(
                        label: choice.$2,
                        description: choice.$3,
                        selected: _settings.wifiQuality == choice.$1,
                        onTap: () =>
                            _update((s) => s.copyWith(wifiQuality: choice.$1)),
                        showDivider: choice.$1 != _choices.last.$1,
                      ),
                  ],
                ),
                const SizedBox(height: 22),
                _groupLabel('Cellular streaming quality'),
                _groupCaption(
                  'Used on mobile data.',
                ),
                const SizedBox(height: 8),
                _card(
                  children: [
                    for (final choice in _choices)
                      _radioRow(
                        label: choice.$2,
                        description: choice.$3,
                        selected: _settings.cellularQuality == choice.$1,
                        onTap: () => _update(
                          (s) => s.copyWith(cellularQuality: choice.$1),
                        ),
                        showDivider: choice.$1 != _choices.last.$1,
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                _note(
                  'Music streams at the same quality on every plan — each '
                  'track has one audio version, so there is nothing to '
                  'unlock. Data Saver only skips the video part of the '
                  'stream. If a track has no audio-only version, the app '
                  'falls back to the full stream on its own.',
                ),
                const SizedBox(height: 24),
              ],
            ),
    );
  }

  Widget _pageHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 6),
      child: Text(
        title,
        style: TextStyle(
          color: context.textPrimary,
          fontWeight: FontWeight.w800,
          fontSize: 19,
          letterSpacing: -0.3,
        ),
      ),
    );
  }

  Widget _groupLabel(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(
        title,
        style: TextStyle(
          color: context.textPrimary,
          fontWeight: FontWeight.w700,
          fontSize: 14.5,
        ),
      ),
    );
  }

  Widget _groupCaption(String text) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 2, 4, 0),
      child: Text(
        text,
        style: TextStyle(color: context.textDim, fontSize: 11.5, height: 1.35),
      ),
    );
  }

  Widget _note(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 1),
            child: Icon(
              Icons.info_outline,
              size: 14,
              color: AppColors.brandOrange,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: context.textDim,
                fontSize: 11.5,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _card({required List<Widget> children}) {
    return Container(
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.borderSubtle),
      ),
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }

  Widget _radioRow({
    required String label,
    required String description,
    required bool selected,
    required VoidCallback onTap,
    required bool showDivider,
  }) {
    return Column(
      children: [
        ListTile(
          onTap: onTap,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          title: Text(
            label,
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 14.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              description,
              style: TextStyle(
                color: context.textDim,
                fontSize: 11.5,
                height: 1.35,
              ),
            ),
          ),
          trailing: Icon(
            selected
                ? Icons.radio_button_checked_rounded
                : Icons.radio_button_unchecked_rounded,
            color: selected ? AppColors.brandOrange : context.textDim,
            size: 22,
          ),
        ),
        if (showDivider)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Divider(color: context.borderSubtle, height: 1),
          ),
      ],
    );
  }
}
