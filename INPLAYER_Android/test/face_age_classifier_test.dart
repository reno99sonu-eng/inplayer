import 'package:flutter_test/flutter_test.dart';
import 'package:inplayer_android/services/age_model_service.dart';
import 'package:inplayer_android/services/face_age_detector_service.dart';

/// Builds a logit vector with the named buckets dominant. A peak of 20
/// against zeros is effectively one-hot after softmax; two equal peaks split
/// the mass evenly.
List<double> _logits(Map<int, double> peaks) {
  final logits = List<double>.filled(kFairFaceAgeBuckets.length, 0.0);
  peaks.forEach((index, value) => logits[index] = value);
  return logits;
}

// Bucket indices, from kFairFaceAgeBuckets.
const int _zeroToTwo = 0;
const int _threeToNine = 1;
const int _tenToNineteen = 2;
const int _thirtyToThirtyNine = 4;

void main() {
  // These tests deliberately exercise the DECISION logic, not the model.
  //
  // The test that used to live here fed invented facial ratios into invented
  // thresholds and asserted they agreed with each other. It passed for the
  // entire period the scanner was broken — first refusing to classify anyone
  // at all, then calling an adult a child — because agreeing with your own
  // made-up numbers proves nothing about faces.
  //
  // The model's own correctness is established elsewhere and differently: the
  // converted network was checked against the original on identical inputs
  // and matched on 60/60. What is left to test here is the small amount of
  // judgement layered on top — how the nine buckets collapse into one
  // under-13 probability, and where that probability is allowed to decide.

  group('age bucket probabilities collapse to a child probability', () {
    test('a confident young child reads as a child', () {
      final e = AgeModelService.interpretLogitsForTest(
        _logits({_threeToNine: 20.0}),
      );
      expect(e.topBucket, '3-9');
      expect(e.childProbability, greaterThan(0.9));
      expect(
        e.childProbability,
        greaterThanOrEqualTo(FaceAgeDetectorService.childDecisionThreshold),
      );
    });

    test('a confident adult reads as an adult', () {
      final e = AgeModelService.interpretLogitsForTest(
        _logits({_thirtyToThirtyNine: 20.0}),
      );
      expect(e.topBucket, '30-39');
      expect(e.childProbability, lessThan(0.05));
      expect(
        e.childProbability,
        lessThanOrEqualTo(FaceAgeDetectorService.adultDecisionThreshold),
      );
    });

    test('the 10-19 bucket contributes only its under-13 share', () {
      // 10, 11 and 12 are three of that bucket's ten years, so a face the
      // model is certain is 10-19 should land at 0.30 on the child scale —
      // and therefore resolve to the adult side, because seven of those ten
      // years are 13 or older. This is the single remaining judgement call
      // in the whole estimate, so it is pinned here on purpose.
      final e = AgeModelService.interpretLogitsForTest(
        _logits({_tenToNineteen: 20.0}),
      );
      expect(e.topBucket, '10-19');
      expect(e.childProbability, closeTo(0.30, 0.01));
      expect(
        e.childProbability,
        lessThanOrEqualTo(FaceAgeDetectorService.adultDecisionThreshold),
      );
    });

    test('an even 3-9 / 10-19 split lands exactly on the decision line', () {
      // Not a coincidence, and worth pinning: an even split gives
      // 0.5 + (0.30 x 0.5) = 0.65, which is precisely
      // childDecisionThreshold. So the most ambiguous realistic read a young
      // face can produce sits on the knife edge by construction.
      //
      // That is also why this asserts closeTo rather than >=. The first
      // version of this test used >= and failed at 0.6499999963 — floating
      // point, not a bug, but a reminder that nothing should be decided by
      // an exact-equality comparison here. It further means the 0.65
      // threshold and the 0.30 bucket share cannot be retuned independently
      // of each other without moving this case across the line.
      final e = AgeModelService.interpretLogitsForTest(
        _logits({_threeToNine: 20.0, _tenToNineteen: 20.0}),
      );
      expect(
        e.childProbability,
        closeTo(FaceAgeDetectorService.childDecisionThreshold, 0.001),
      );
    });

    test('mass weighted toward the younger band reads as a child', () {
      final e = AgeModelService.interpretLogitsForTest(
        _logits({_threeToNine: 20.0, _tenToNineteen: 18.0}),
      );
      expect(
        e.childProbability,
        greaterThan(FaceAgeDetectorService.childDecisionThreshold),
      );
    });

    test('a genuinely split read decides nothing', () {
      // Half child, half adult. The scanner must refuse rather than pick —
      // this band is what makes int8 quantisation drift (up to ~0.11 in
      // logit space) incapable of changing an outcome, because anything
      // close enough to be flipped by it is never decided in the first
      // place.
      final e = AgeModelService.interpretLogitsForTest(
        _logits({_threeToNine: 20.0, _thirtyToThirtyNine: 20.0}),
      );
      expect(
        e.childProbability,
        greaterThan(FaceAgeDetectorService.adultDecisionThreshold),
      );
      expect(
        e.childProbability,
        lessThan(FaceAgeDetectorService.childDecisionThreshold),
      );
    });

    test('probabilities stay in range for an all-zero read', () {
      final e = AgeModelService.interpretLogitsForTest(
        List<double>.filled(kFairFaceAgeBuckets.length, 0.0),
      );
      expect(e.childProbability, inInclusiveRange(0.0, 1.0));
      expect(e.topBucketProbability, inInclusiveRange(0.0, 1.0));
    });
  });

  test('the undecided band is the right way round', () {
    // A transposition here would silently invert the whole scanner.
    expect(
      FaceAgeDetectorService.adultDecisionThreshold,
      lessThan(FaceAgeDetectorService.childDecisionThreshold),
    );
  });

  test('bucket labels match the model head width', () {
    expect(kFairFaceAgeBuckets.length, 9);
    expect(kFairFaceAgeBuckets.first, '0-2');
    expect(kFairFaceAgeBuckets[_zeroToTwo], '0-2');
    expect(kFairFaceAgeBuckets.last, '70+');
  });
}
