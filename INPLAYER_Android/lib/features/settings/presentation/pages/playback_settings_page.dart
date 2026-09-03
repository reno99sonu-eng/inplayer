import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/playback_position_store.dart';
import '../../../../core/utils/playback_settings_store.dart';
import '../../../../services/pip_service.dart';

/// Real "Settings > Playback" preferences — a direct port of
/// PlaybackSection.tsx (app/components/settings/sections/PlaybackSection.tsx),
/// row for row and default for default, right down to which rows the
/// website itself leaves disabled. Autoplay Next and Skip Intro are
/// honestly "not available yet" on the *website too* — matching that is
/// real parity, not a corner cut here. Picture in Picture is now real
/// (Android only, via pip_service.dart's native platform channel) — this
/// toggle controls *automatic* PiP when leaving the app while a video
/// plays; the in-player PiP button (see player_chrome.dart) always works
/// regardless of this setting, same as a manual action bypassing an "auto"
/// preference everywhere else in the app.
class PlaybackSettingsPage extends StatefulWidget {
  const PlaybackSettingsPage({super.key});

  @override
  State<PlaybackSettingsPage> createState() => _PlaybackSettingsPageState();
}

class _PlaybackSettingsPageState extends State<PlaybackSettingsPage> {
  PlaybackSettings _settings = const PlaybackSettings();
  bool _loaded = false;
  bool _pipSupportedOnDevice = false;

  // Mirrors QUALITY_OPTIONS in app/lib/premium.ts exactly — 'auto' plus the
  // four real Mux maxResolution values. (Deliberately no 480p/360p — those
  // are valid Mux MIN renditions but not valid MAX/ceiling values.)
  static const _qualityChoices = [
    ('auto', 'Auto'),
    ('720p', '720p (HD)'),
    ('1080p', '1080p (Full HD)'),
    ('1440p', '1440p (2K)'),
    ('2160p', '2160p (4K Ultra HD)'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final settings = await PlaybackSettingsStore.get();
    // PiP is Android-only and needs Android 7.0+ — checked once here (not
    // re-checked per build) so the toggle can honestly disable itself with
    // an accurate reason on a device/OS that can't actually do it, rather
    // than letting someone turn on a preference that can never fire.
    final pipSupported = await PipService.isSupported();
    if (!mounted) return;
    setState(() {
      _settings = settings;
      _pipSupportedOnDevice = pipSupported;
      _loaded = true;
    });
  }

  Future<void> _update(
    PlaybackSettings Function(PlaybackSettings) patch,
  ) async {
    final next = patch(_settings);
    setState(() => _settings = next);
    await PlaybackSettingsStore.update(next);
  }

  String _qualityLabel(String value) {
    for (final choice in _qualityChoices) {
      if (choice.$1 == value) return choice.$2;
    }
    return 'Auto';
  }

  Future<void> _pickQuality({
    required String title,
    required String current,
    required ValueChanged<String> onPicked,
  }) async {
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
                title,
                style: TextStyle(
                  color: ctx.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              for (final choice in _qualityChoices)
                InkWell(
                  onTap: () {
                    Navigator.pop(ctx);
                    onPicked(choice.$1);
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    margin: const EdgeInsets.only(bottom: 6),
                    decoration: BoxDecoration(
                      color: choice.$1 == current
                          ? AppColors.brandOrange.withValues(alpha: 0.12)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            choice.$2,
                            style: TextStyle(
                              color: choice.$1 == current
                                  ? AppColors.brandOrange
                                  : ctx.textPrimary,
                              fontWeight: choice.$1 == current
                                  ? FontWeight.bold
                                  : FontWeight.w500,
                              fontSize: 15,
                            ),
                          ),
                        ),
                        if (choice.$1 == current)
                          const Icon(
                            Icons.check_circle,
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
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                _heroCard(),
                const SizedBox(height: 14),
                _settingsCard(
                  children: [
                    _sectionHeader('Streaming'),
                    _selectRow(
                      icon: Icons.smartphone_outlined,
                      title: 'Shorts & mobile quality',
                      description: 'Caps the quality used in the Shorts feed.',
                      value: _qualityLabel(_settings.mobileQuality),
                      onTap: () => _pickQuality(
                        title: 'Shorts & mobile quality',
                        current: _settings.mobileQuality,
                        onPicked: (v) =>
                            _update((s) => s.copyWith(mobileQuality: v)),
                      ),
                    ),
                    _selectRow(
                      icon: Icons.wifi,
                      title: 'Video quality',
                      description: 'Caps the quality on watch pages.',
                      value: _qualityLabel(_settings.wifiQuality),
                      onTap: () => _pickQuality(
                        title: 'Video quality',
                        current: _settings.wifiQuality,
                        onPicked: (v) =>
                            _update((s) => s.copyWith(wifiQuality: v)),
                      ),
                    ),
                    _premiumNote(
                      'Free accounts stream up to 1080p (Full HD). 1440p and 4K Ultra HD are part of InPlayer Premium — picking them here does nothing on a free account.',
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _settingsCard(
                  children: [
                    _sectionHeader('Playback'),
                    _switchRow(
                      icon: Icons.play_circle_outline,
                      title: 'Autoplay Next Video',
                      description:
                          'Not available yet — needs an up-next queue, which the watch page doesn’t have.',
                      value: _settings.autoplay,
                      onChanged: (v) => _update((s) => s.copyWith(autoplay: v)),
                    ),
                    _switchRow(
                      icon: Icons.picture_in_picture_alt_outlined,
                      title: 'Picture in Picture',
                      description: _pipSupportedOnDevice
                          ? 'Automatically switch to a small floating window when you leave the app while a video is playing. The in-player PiP button always works either way.'
                          : 'Not available on this device — needs Android 7.0 or newer.',
                      value: _settings.pip,
                      onChanged: _pipSupportedOnDevice
                          ? (v) => _update((s) => s.copyWith(pip: v))
                          : null,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _settingsCard(
                  children: [
                    _sectionHeader('Accessibility'),
                    _switchRow(
                      icon: Icons.closed_caption_outlined,
                      title: 'Closed Captions',
                      description: 'Show captions whenever available.',
                      value: _settings.captions,
                      onChanged: (v) => _update((s) => s.copyWith(captions: v)),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _settingsCard(
                  children: [
                    _sectionHeader('Data'),
                    _switchRow(
                      icon: Icons.data_usage_outlined,
                      title: 'Data Saver',
                      description:
                          'Reduce streaming quality to save mobile data.',
                      value: _settings.dataSaver,
                      onChanged: (v) =>
                          _update((s) => s.copyWith(dataSaver: v)),
                    ),
                    _switchRow(
                      icon: Icons.history,
                      title: 'Remember playback position',
                      description: 'Pick up long videos where you left off.',
                      value: _settings.rememberPosition,
                      onChanged: (v) async {
                        await _update((s) => s.copyWith(rememberPosition: v));
                        if (!v) await PlaybackPositionStore.clearAll();
                      },
                    ),
                    _switchRow(
                      icon: Icons.fast_forward_outlined,
                      title: 'Skip Intro Automatically',
                      description:
                          'Not available yet — needs automatic intro detection, which nothing generates at upload.',
                      value: _settings.skipIntro,
                      onChanged: (v) =>
                          _update((s) => s.copyWith(skipIntro: v)),
                    ),
                    _switchRow(
                      icon: Icons.headset_outlined,
                      title: 'Background Playback',
                      description:
                          'Not available yet — needs a foreground media service to keep audio playing after you leave the app.',
                      value: _settings.backgroundPlayback,
                      onChanged: (v) =>
                          _update((s) => s.copyWith(backgroundPlayback: v)),
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
        border: Border.all(
          color: AppColors.brandOrange.withValues(alpha: 0.22),
        ),
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
              Icons.play_circle_fill_rounded,
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
                  'Playback preferences',
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Tune mobile quality, captions, and how videos resume on your device.',
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

  Widget _premiumNote(String text) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline, size: 14, color: AppColors.brandOrange),
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
          color: enabled
              ? AppColors.brandOrange.withValues(alpha: 0.12)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          value,
          style: TextStyle(
            color: enabled ? AppColors.brandOrange : context.textDim,
            fontWeight: FontWeight.w700,
            fontSize: 12.5,
          ),
        ),
      ),
      onTap: onTap,
    );
  }

  Widget _switchRow({
    required IconData icon,
    required String title,
    required String description,
    required bool value,
    required ValueChanged<bool>? onChanged,
  }) {
    final enabled = onChanged != null;
    return SwitchListTile.adaptive(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
      secondary: Container(
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
      activeThumbColor: Colors.white,
      activeTrackColor: AppColors.brandOrange,
      inactiveThumbColor: Colors.white,
      inactiveTrackColor: context.isDark
          ? const Color(0xFF475569)
          : const Color(0xFFCBD5E1),
      value: value,
      onChanged: onChanged,
    );
  }
}
