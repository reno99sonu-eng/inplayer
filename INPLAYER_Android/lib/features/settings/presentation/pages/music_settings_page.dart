import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/playback_settings_store.dart';

/// Settings for the music player specifically.
///
/// The gear in the music player and on the music tab used to open
/// Settings > Playback, which is the *video* page: it offered "Shorts &
/// mobile quality", "Video quality" and a note about 1080p and 4K, none of
/// which mean anything while listening to a track. This page carries the
/// controls that apply to audio, and links across to the video page rather
/// than hiding it.
///
/// There is exactly one audio choice to make, not a quality ladder: Mux
/// publishes a single audio-only rendition per asset (verified against
/// Mux's static-rendition guide — `stream.mux.com/{id}/audio.m4a`, no
/// bitrate variants), so "Data Saver" means "stream the audio-only file
/// instead of the full adaptive stream", and that is the whole decision.
class MusicSettingsPage extends StatefulWidget {
  const MusicSettingsPage({super.key});

  @override
  State<MusicSettingsPage> createState() => _MusicSettingsPageState();
}

class _MusicSettingsPageState extends State<MusicSettingsPage> {
  PlaybackSettings _settings = const PlaybackSettings();
  bool _loaded = false;

  // Stored values are 'High' / 'Low' (see PlaybackSettingsStore).
  static const _audioChoices = [
    ('High', 'High quality'),
    ('Low', 'Data Saver'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final settings = await PlaybackSettingsStore.get();
    if (!mounted) return;
    setState(() {
      _settings = settings;
      _loaded = true;
    });
  }

  Future<void> _update(PlaybackSettings Function(PlaybackSettings) patch) async {
    final next = patch(_settings);
    setState(() => _settings = next);
    await PlaybackSettingsStore.update(next);
  }

  String _audioLabel(String value) {
    for (final choice in _audioChoices) {
      if (choice.$1.toLowerCase() == value.toLowerCase()) return choice.$2;
    }
    return 'High quality';
  }

  Future<void> _pickAudioQuality() async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: ctx.bgModal,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: ctx.borderSubtle),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: ctx.textDim.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Audio quality',
                style: TextStyle(
                  color: ctx.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              for (final choice in _audioChoices)
                InkWell(
                  onTap: () {
                    Navigator.of(ctx).pop();
                    _update((s) => s.copyWith(audioQuality: choice.$1));
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 12,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                choice.$2,
                                style: TextStyle(
                                  color: ctx.textPrimary,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                choice.$1 == 'High'
                                    ? 'Full adaptive stream. Best on Wi-Fi.'
                                    : 'Audio only — skips the video part of '
                                          'the stream and uses far less data.',
                                style: TextStyle(
                                  color: ctx.textDim,
                                  fontSize: 11.5,
                                  height: 1.35,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (choice.$1.toLowerCase() ==
                            _settings.audioQuality.toLowerCase())
                          const Icon(
                            Icons.check_rounded,
                            color: AppColors.brandOrange,
                            size: 20,
                          ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
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
          'Music',
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
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                _heroCard(),
                const SizedBox(height: 14),
                _settingsCard(
                  children: [
                    _sectionHeader('Audio'),
                    _selectRow(
                      icon: Icons.graphic_eq_rounded,
                      title: 'Audio quality',
                      description:
                          'Data Saver streams the audio-only version of a '
                          'track. If a track has no audio-only version, the '
                          'app falls back on its own.',
                      value: _audioLabel(_settings.audioQuality),
                      onTap: _pickAudioQuality,
                    ),
                    _selectRow(
                      icon: Icons.graphic_eq_rounded,
                      title: 'Equalizer',
                      description:
                          "Adjust the bands your phone's audio hardware "
                          'exposes. Applies to music playing in this app.',
                      value: 'Open',
                      onTap: () => context.push('/settings/music/equalizer'),
                    ),
                    _note(
                      'Music streams at the same quality on every plan — each '
                      'track has one audio version, so there is nothing to '
                      'unlock. Data Saver only skips the video part of the '
                      'stream.',
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _settingsCard(
                  children: [
                    _sectionHeader('Elsewhere'),
                    _selectRow(
                      icon: Icons.play_circle_outline,
                      title: 'Video & Shorts quality',
                      description:
                          'Resolution caps, captions and Picture in Picture.',
                      value: 'Open',
                      onTap: () => context.push('/settings/playback'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
              ],
            ),
    );
  }

  Widget _heroCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.brandOrange.withValues(alpha: 0.18),
            context.isDark ? const Color(0xFF111827) : const Color(0xFFFFFFFF),
          ],
        ),
        border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.22)),
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: AppColors.brandOrange,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.music_note_rounded,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Music preferences',
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'How tracks stream while you listen.',
                  style: TextStyle(
                    color: context.textSecondary,
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _settingsCard({required List<Widget> children}) {
    return Container(
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.borderSubtle),
      ),
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          color: AppColors.brandOrange,
          fontWeight: FontWeight.w800,
          fontSize: 11,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _note(String text) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline,
            size: 14,
            color: AppColors.brandOrange,
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

  Widget _selectRow({
    required IconData icon,
    required String title,
    required String description,
    required String value,
    required VoidCallback? onTap,
  }) {
    final enabled = onTap != null;
    return ListTile(
      enabled: enabled,
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      leading: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: enabled
              ? AppColors.brandOrange.withValues(alpha: 0.12)
              : context.borderSubtle,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(
          icon,
          color: enabled ? AppColors.brandOrange : context.textDim,
          size: 18,
        ),
      ),
      title: Text(
        title,
        style: TextStyle(
          color: enabled ? context.textPrimary : context.textDim,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Text(
        description,
        style: TextStyle(color: context.textDim, fontSize: 11.5, height: 1.35),
      ),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.brandOrange.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          value,
          style: const TextStyle(
            color: AppColors.brandOrange,
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
