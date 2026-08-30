import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/services/face_age_detector_service.dart';

void main() {
  group('FaceAgeDetectorService classification', () {
    test('classifies child-like proportions as child', () {
      final result = FaceAgeDetectorService.classifyFaceMetrics(
        roundnessRatio: 0.92,
        lowerFaceRatio: 0.34,
        ocularProportion: 0.46,
        isFacingFront: true,
      );

      expect(result.category, AgeCategory.child);
      expect(result.confidence, greaterThanOrEqualTo(0.65));
    });

    test('classifies adult-like proportions as teenOrAdult', () {
      final result = FaceAgeDetectorService.classifyFaceMetrics(
        roundnessRatio: 0.72,
        lowerFaceRatio: 0.48,
        ocularProportion: 0.33,
        isFacingFront: true,
      );

      expect(result.category, AgeCategory.teenOrAdult);
      expect(result.confidence, greaterThanOrEqualTo(0.65));
    });
  });
}
