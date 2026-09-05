import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/equalizer_presets.dart';
import '../../../../core/utils/equalizer_store.dart';
import '../../../../core/utils/music_settings_store.dart';
import '../../../../services/music_player_service.dart';

/// Playback settings for music, grouped the way a listener thinks about
/// them: what happens between tracks, how loud they are, and how they get
/// to the phone.
///
/// Everything on this screen does something. There is no row here for a
/// switch the app cannot actually honour — a settings screen that lies is
/// worse than a short one.
class MusicSettingsPage extends ConsumerStatefulWidget {
  const MusicSettingsPage({super.key});

  @override
  ConsumerState<MusicSettingsPage> createState() => _MusicSettingsPageState();
}

class _MusicSettingsPageState extends ConsumerState<MusicSettingsPage> {
  MusicSettings _settings = const MusicSettings();
  String _equalizerSummary = 'Off';
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final settings = await MusicSettingsStore.get();
    final equalizer = await EqualizerStore.get();
    if (!mounted) return;
    setState(() {
      _settings = settings;
      _equalizerSummary = equalizer.enabled
          ? EqualizerPreset.labelFor(equalizer.preset)
          : 'Off';
      _loaded = true;
    });
  }

  Future<void> _update(MusicSettings Function(MusicSettings) patch) async {
    final next = patch(_settings);
    setState(() => _settings = next);
    await MusicSettingsStore.save(next);
    // Apply immediately rather than at the next queue: a person who turns
    // volume levelling on is listening right now and expects to hear it.
    await ref.read(musicPlayerServiceProvider).applyMusicSettings(next);
  }

  String get _qualitySummary {
    final wifi = _settings.wifiQuality == MusicSettings.qualitySaver
        ? 'Data Saver'
        : 'High';
    final cell = _settings.cellularQuality == MusicSettings.qualitySaver
        ? 'Data Saver'
        : 'High';
    return wifi == cell ? wifi : 'Wi-Fi $wifi · Mobile $cell';
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
          'Playback',
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
                _sectionHeader('Listening controls'),
                _card(
                  children: [
                    _switchRow(
                      title: 'Autoplay',
                      description:
                          'Similar music keeps playing when your queue runs '
                          'out.',
                      value: _settings.autoplay,
                      onChanged: (v) =>
                          _update((s) => s.copyWith(autoplay: v)),
                    ),
                    _divider(),
                    _linkRow(
                      title: 'Equalizer',
                      description:
                          'Adjust different frequencies to enhance your audio '
                          'experience.',
                      value: _equalizerSummary,
                      onTap: () async {
                        await context.push('/settings/music/equalizer');
                        await _load();
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                _sectionHeader('Volume controls'),
                _card(
                  children: [
                    _switchRow(
                      title: 'Volume levelling',
                      description:
                          'Lifts quieter tracks so the volume stays even '
                          'across the queue.',
                      value: _settings.volumeLevelling,
                      onChanged: (v) =>
                          _update((s) => s.copyWith(volumeLevelling: v)),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                _sectionHeader('Audio quality'),
                _card(
                  children: [
                    _linkRow(
                      title: 'Media quality',
                      description:
                          'Streaming quality on Wi-Fi and on mobile data.',
                      value: _qualitySummary,
                      onTap: () async {
                        await context.push('/settings/music/quality');
                        await _load();
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 24),
              ],
            ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 12, 4, 10),
      child: Text(
        title,
        style: TextStyle(
          color: context.textPrimary,
          fontWeight: FontWeight.w800,
          fontSize: 17,
          letterSpacing: -0.2,
        ),
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

  Widget _divider() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Divider(color: context.borderSubtle, height: 1),
      );

  Widget _switchRow({
    required String title,
    required String description,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return SwitchListTile.adaptive(
      value: value,
      onChanged: onChanged,
      activeThumbColor: AppColors.brandOrange,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      title: Text(
        title,
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
    );
  }

  Widget _linkRow({
    required String title,
    required String description,
    required String value,
    required VoidCallback onTap,
  }) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      title: Text(
        title,
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
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: TextStyle(
              color: context.textSecondary,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 4),
          Icon(
            Icons.chevron_right_rounded,
            color: context.textDim,
            size: 20,
          ),
        ],
      ),
    );
  }
}
