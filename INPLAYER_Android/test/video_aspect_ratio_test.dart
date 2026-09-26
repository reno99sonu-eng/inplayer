import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// Pure logic mirror of _playerBoxAspect from WatchPage
double computePlayerBoxAspect({
  required bool isInitialized,
  required Size size,
  bool isStrictMusic = false,
}) {
  if (!isInitialized) return 16 / 9;
  if (isStrictMusic) return 16 / 9;
  if (size.width <= 0 || size.height <= 0) return 16 / 9;
  final ratio = size.width / size.height;
  if (ratio >= 1) return 16 / 9;
  return math.max(ratio, 4 / 5);
}

void main() {
  group('Video Aspect Ratio & Framing Logic', () {
    test('Standard landscape 16:9 video uses 16/9 frame', () {
      final aspect = computePlayerBoxAspect(
        isInitialized: true,
        size: const Size(1920, 1080),
      );
      expect(aspect, closeTo(16 / 9, 0.001));
    });

    test('Ultrawide 21:9 landscape video uses 16/9 frame to preserve standard UI', () {
      final aspect = computePlayerBoxAspect(
        isInitialized: true,
        size: const Size(2560, 1080),
      );
      expect(aspect, closeTo(16 / 9, 0.001));
    });

    test('Square 1:1 video uses 16/9 frame since ratio >= 1', () {
      final aspect = computePlayerBoxAspect(
        isInitialized: true,
        size: const Size(1080, 1080),
      );
      expect(aspect, closeTo(16 / 9, 0.001));
    });

    test('Portrait 9:16 video caps at 4/5 (0.8) so controls remain usable', () {
      final aspect = computePlayerBoxAspect(
        isInitialized: true,
        size: const Size(1080, 1920), // 9:16 = 0.5625
      );
      expect(aspect, closeTo(4 / 5, 0.001));
      expect(aspect, equals(0.8));
    });

    test('Portrait 3:4 video (0.75) caps at 4/5 (0.8)', () {
      final aspect = computePlayerBoxAspect(
        isInitialized: true,
        size: const Size(750, 1000), // 0.75
      );
      expect(aspect, closeTo(4 / 5, 0.001));
    });

    test('Mild portrait video with ratio > 0.8 uses its intrinsic ratio', () {
      final aspect = computePlayerBoxAspect(
        isInitialized: true,
        size: const Size(850, 1000), // 0.85
      );
      expect(aspect, closeTo(0.85, 0.001));
    });

    test('Music tracks always use 16/9 frame regardless of intrinsic dimensions', () {
      final aspect = computePlayerBoxAspect(
        isInitialized: true,
        size: const Size(1080, 1920),
        isStrictMusic: true,
      );
      expect(aspect, closeTo(16 / 9, 0.001));
    });

    test('Uninitialized video defaults to 16/9 frame', () {
      final aspect = computePlayerBoxAspect(
        isInitialized: false,
        size: const Size(1080, 1920),
      );
      expect(aspect, closeTo(16 / 9, 0.001));
    });
  });
}
