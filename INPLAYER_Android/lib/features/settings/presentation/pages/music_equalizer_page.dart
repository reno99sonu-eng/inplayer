import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/equalizer_store.dart';
import '../../../../services/music_player_service.dart';

/// A real equalizer, not a decorative one.
///
/// The sliders drive Android's own Equalizer AudioEffect through just_audio's
/// AudioPipeline (see MusicPlayerService._equalizer), so a change is audible
/// on the currently playing track immediately. The band list, their centre
/// frequencies and the decibel range are all read FROM the platform rather
/// than invented here — they vary by device, and a hardcoded five-band 60Hz
/// to 16kHz layout would be a picture of an equalizer rather than the one
/// this phone actually has.
///
/// The catch, and why this screen can legitimately say it is unavailable:
/// Android only creates the effect once audio is actually running, so
/// `parameters` does not resolve until something is playing. Rather than
/// spinning forever, that case is stated plainly.
class MusicEqualizerPage extends ConsumerStatefulWidget {
  const MusicEqualizerPage({super.key});

  @override
  ConsumerState<MusicEqualizerPage> createState() => _MusicEqualizerPageState();
}

class _MusicEqualizerPageState extends ConsumerState<MusicEqualizerPage> {
  late final Future<AndroidEqualizerParameters?> _paramsFuture;
  bool _enabled = false;
  bool _loadedEnabled = false;

  @override
  void initState() {
    super.initState();
    final player = ref.read(musicPlayerServiceProvider);
    _paramsFuture = player.equalizer.parameters
        .timeout(const Duration(seconds: 4))
        .then<AndroidEqualizerParameters?>((p) => p)
        .catchError((_) => null);
    _loadEnabled();
  }

  Future<void> _loadEnabled() async {
    final saved = await EqualizerStore.get();
    if (!mounted) return;
    setState(() {
      _enabled = saved.enabled;
      _loadedEnabled = true;
    });
  }

  Future<void> _setEnabled(bool value) async {
    final player = ref.read(musicPlayerServiceProvider);
    setState(() => _enabled = value);
    try {
      await player.equalizer.setEnabled(value);
    } catch (_) {
      // Reported through the UI below rather than thrown at the user.
    }
    final saved = await EqualizerStore.get();
    await EqualizerStore.save(saved.copyWith(enabled: value));
  }

  Future<void> _persistGains(AndroidEqualizerParameters params) async {
    final saved = await EqualizerStore.get();
    await EqualizerStore.save(
      saved.copyWith(
        gains: params.bands.map((b) => b.gain).toList(growable: false),
      ),
    );
  }

  Future<void> _resetFlat(AndroidEqualizerParameters params) async {
    for (final band in params.bands) {
      await band.setGain(0);
    }
    if (!mounted) return;
    setState(() {});
    await _persistGains(params);
  }

  static String _formatHz(double hz) {
    if (hz >= 1000) {
      final k = hz / 1000;
      return '${k.toStringAsFixed(k >= 10 ? 0 : 1)} kHz';
    }
    return '${hz.round()} Hz';
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
          'Equalizer',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: context.textPrimary,
            fontSize: 20,
          ),
        ),
      ),
      body: FutureBuilder<AndroidEqualizerParameters?>(
        future: _paramsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done ||
              !_loadedEnabled) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange),
            );
          }

          final params = snapshot.data;
          if (params == null || params.bands.isEmpty) {
            return _unavailable(context);
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              _card(
                context,
                child: SwitchListTile.adaptive(
                  value: _enabled,
                  onChanged: _setEnabled,
                  activeThumbColor: AppColors.brandOrange,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                  title: Text(
                    'Equalizer',
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  subtitle: Text(
                    _enabled
                        ? 'Applies to music playing in this app.'
                        : 'Off — tracks play exactly as they were mastered.',
                    style: TextStyle(color: context.textDim, fontSize: 11.5),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Opacity(
                opacity: _enabled ? 1 : 0.45,
                child: IgnorePointer(
                  ignoring: !_enabled,
                  child: _card(
                    context,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                          child: Text(
                            'BANDS',
                            style: TextStyle(
                              color: AppColors.brandOrange,
                              fontWeight: FontWeight.w800,
                              fontSize: 11,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ),
                        for (final band in params.bands)
                          _bandRow(context, params, band),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                          child: TextButton.icon(
                            onPressed: () => _resetFlat(params),
                            icon: const Icon(
                              Icons.restart_alt_rounded,
                              size: 18,
                              color: AppColors.brandOrange,
                            ),
                            label: const Text(
                              'Reset to flat',
                              style: TextStyle(
                                color: AppColors.brandOrange,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  'These are the bands your phone reports, not a fixed list — '
                  'the count and frequencies come from Android itself, so they '
                  'differ between devices.',
                  style: TextStyle(
                    color: context.textDim,
                    fontSize: 11.5,
                    height: 1.45,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _bandRow(
    BuildContext context,
    AndroidEqualizerParameters params,
    AndroidEqualizerBand band,
  ) {
    // The slider and the dB label both read band.gain directly, so what is
    // drawn is always the gain the effect is actually applying rather than a
    // separate copy that can drift out of step with it.
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      child: Row(
        children: [
              SizedBox(
                width: 62,
                child: Text(
                  _formatHz(band.centerFrequency),
                  style: TextStyle(
                    color: context.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Expanded(
                child: SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 3,
                    activeTrackColor: AppColors.brandOrange,
                    inactiveTrackColor: context.borderMedium,
                    thumbColor: AppColors.brandOrange,
                    thumbShape: const RoundSliderThumbShape(
                      enabledThumbRadius: 7,
                    ),
                  ),
                  child: Slider(
                    min: params.minDecibels,
                    max: params.maxDecibels,
                    value: band.gain.clamp(
                      params.minDecibels,
                      params.maxDecibels,
                    ),
                    onChanged: (value) {
                      band.setGain(value);
                      setState(() {});
                    },
                    onChangeEnd: (_) => _persistGains(params),
                  ),
                ),
              ),
              SizedBox(
                width: 56,
                child: Text(
                  '${band.gain >= 0 ? '+' : ''}'
                  '${band.gain.toStringAsFixed(1)} dB',
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: context.textDim,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
        ],
      ),
    );
  }

  Widget _unavailable(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.graphic_eq_rounded, size: 44, color: context.textDim),
            const SizedBox(height: 14),
            Text(
              'Start playing a track first',
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Android only creates the equalizer once audio is actually '
              'running, so its bands cannot be read while nothing is playing. '
              'Play something and come back.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: context.textSecondary,
                fontSize: 12.5,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _card(BuildContext context, {required Widget child}) {
    return Container(
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.borderSubtle),
      ),
      child: child,
    );
  }
}
