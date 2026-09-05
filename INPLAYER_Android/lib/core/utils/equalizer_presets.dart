import 'dart:math' as math;

/// Named equalizer presets, stored as a curve rather than a fixed list of
/// slider positions.
///
/// Android decides how many bands the equalizer has and where their centre
/// frequencies sit. Five is typical, but it is genuinely per-device — the
/// band list is read from the platform, not chosen by the app. A preset
/// saved as "these five numbers" would therefore land on the wrong
/// frequencies on any phone whose layout differs, which is how preset
/// pickers end up sounding subtly wrong.
///
/// Each preset here is instead a gain curve sampled at fixed reference
/// frequencies. [EqualizerPreset.gainsFor] reads that curve at whatever
/// frequencies THIS phone reports, interpolating between the samples in
/// log-frequency space — the space octaves are evenly spaced in, and the
/// space the ear actually hears in. A three-band device and a ten-band
/// device therefore get the same tonal shape rather than the same numbers.
class EqualizerPreset {
  /// Stable identifier, persisted. Never shown to anyone.
  final String id;

  /// What the pill says.
  final String label;

  /// Gain in decibels at each frequency in [referenceHz], in that order.
  final List<double> curve;

  const EqualizerPreset(this.id, this.label, this.curve);

  /// The frequencies [curve] is sampled at. Standard ten-band ISO centres.
  static const List<double> referenceHz = [
    31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
  ];

  /// Identifier used when the sliders have been moved by hand and no named
  /// preset describes the result any more.
  static const String customId = 'custom';

  /// Reads this preset's curve at [centerFrequencies] and clamps the result
  /// into the range the device's equalizer will accept.
  List<double> gainsFor(
    List<double> centerFrequencies, {
    required double minDb,
    required double maxDb,
  }) {
    return centerFrequencies
        .map((hz) => _sample(hz).clamp(minDb, maxDb).toDouble())
        .toList(growable: false);
  }

  double _sample(double hz) {
    if (hz <= referenceHz.first) return curve.first;
    if (hz >= referenceHz.last) return curve.last;

    for (var i = 0; i < referenceHz.length - 1; i++) {
      final lo = referenceHz[i];
      final hi = referenceHz[i + 1];
      if (hz < lo || hz > hi) continue;
      // Interpolate across the octave, not across the raw Hz gap: 500Hz sits
      // halfway between 250 and 1000 to the ear, not a third of the way.
      final t =
          (math.log(hz) - math.log(lo)) / (math.log(hi) - math.log(lo));
      return curve[i] + (curve[i + 1] - curve[i]) * t;
    }
    return curve.last;
  }

  /// Every named preset, in the order they appear on screen. Flat is first
  /// because it is the "off" of preset pickers — it is what the equalizer
  /// does when it is doing nothing.
  static const List<EqualizerPreset> all = [
    EqualizerPreset('flat', 'Flat',
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    EqualizerPreset('rock', 'Rock',
        [5, 4, 3, 1, -1, -1, 2, 3, 4, 4]),
    EqualizerPreset('pop', 'Pop',
        [-1, -1, 0, 2, 4, 4, 2, 0, -1, -1]),
    EqualizerPreset('jazz', 'Jazz',
        [4, 3, 1, 2, -1, -1, 0, 1, 3, 4]),
    EqualizerPreset('blues', 'Blues',
        [3, 2, 1, 1, 0, -1, 0, 2, 3, 3]),
    EqualizerPreset('classical', 'Classical',
        [4, 3, 2, 0, 0, 0, 0, -2, -3, -3]),
    EqualizerPreset('dance', 'Dance',
        [6, 5, 3, 0, 0, -2, -3, -3, 0, 2]),
    EqualizerPreset('hiphop', 'Hip-Hop',
        [6, 5, 2, 3, -1, -1, 1, -1, 2, 3]),
    EqualizerPreset('acoustic', 'Acoustic',
        [4, 4, 3, 1, 1, 1, 2, 3, 3, 2]),
    EqualizerPreset('vocal', 'Vocal',
        [-2, -2, -1, 2, 4, 4, 3, 2, 0, -1]),
    EqualizerPreset('bass', 'Bass Boost',
        [7, 6, 4, 2, 0, 0, 0, 0, 0, 0]),
    EqualizerPreset('treble', 'Treble Boost',
        [0, 0, 0, 0, 0, 1, 3, 5, 6, 7]),
  ];

  /// Looks a preset up by [id]. Returns null for [customId] and for any id
  /// written by a future version of the app that this one does not know.
  static EqualizerPreset? byId(String? id) {
    if (id == null || id == customId) return null;
    for (final preset in all) {
      if (preset.id == id) return preset;
    }
    return null;
  }

  /// Label to show for a stored id, including the hand-tuned case.
  static String labelFor(String? id) => byId(id)?.label ?? 'Custom';
}
