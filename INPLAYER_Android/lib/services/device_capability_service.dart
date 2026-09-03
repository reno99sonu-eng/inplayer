import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';

/// Answers one narrow question: is it safe on this device to run TWO video
/// decoders at once?
///
/// Raftaar's preload feature (see ShortsPage/ShortPlayerWidget) keeps the
/// next short's decoder warming up in the background while the current one
/// is still playing, to kill the flash-before-play on swipe. That's
/// perfectly fine on modern/mid-range phones, which comfortably support
/// multiple concurrent MediaCodec decoder sessions. But some older or
/// budget Android devices only expose one reliable hardware decoder slot —
/// forcing a second concurrent decode session on those doesn't just run
/// slower, it can corrupt the picture (green/blocky diagonal tearing, the
/// kind reported from a device we don't have in hand to test on directly).
///
/// Android SDK version is a coarse but conservative proxy for that: no
/// public API on Android exposes "how many concurrent hardware decoder
/// sessions does this chipset actually support" directly, and probing it
/// by trying to open two MediaCodec instances and seeing if one glitches
/// is exactly the failure mode we're trying to avoid causing in the first
/// place. Gating on OS version instead means erring toward the safe,
/// pre-preload cold-start behavior on any device we're not reasonably
/// confident about, at the cost of some newer devices below the cutoff
/// missing out on the smoother preload experience unnecessarily.
class DeviceCapabilityService {
  DeviceCapabilityService._();

  /// Android 10 (API 29) and up. Chosen because Android 10 brought
  /// significant media-framework hardening (and, via Treble, more
  /// consistent vendor MediaCodec behavior across OEMs) — devices still
  /// shipping with anything older than this skew heavily toward
  /// older/budget hardware, which is exactly the population where a second
  /// concurrent decoder is more likely to be unreliable rather than merely
  /// slower.
  static const int _minSdkIntForPreload = 29;

  static bool? _cachedResult;

  /// Whether Raftaar's next-short video preload should run on this device.
  /// Result is cached after the first successful check (device hardware
  /// doesn't change mid-session). Any failure to determine this — enumeration
  /// error, non-Android platform — resolves to `false`: the same "don't
  /// guess yes" principle already used for the face-scan camera-hardware
  /// check, since guessing wrong here risks corrupted video rather than
  /// just a skipped feature.
  static Future<bool> canPreloadVideo() async {
    final cached = _cachedResult;
    if (cached != null) return cached;

    if (kIsWeb || !Platform.isAndroid) {
      _cachedResult = false;
      return false;
    }

    try {
      final androidInfo = await DeviceInfoPlugin().androidInfo;
      final result = androidInfo.version.sdkInt >= _minSdkIntForPreload;
      _cachedResult = result;
      return result;
    } catch (e) {
      debugPrint('[DeviceCapabilityService] SDK version check failed: $e');
      _cachedResult = false;
      return false;
    }
  }
}
