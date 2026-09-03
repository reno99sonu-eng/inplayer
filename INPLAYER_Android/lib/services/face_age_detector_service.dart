import 'dart:io';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

import 'age_model_service.dart';

enum AgeCategory {
  child, // < 13 years old
  teenOrAdult, // >= 13 years old
  unknown,
}

class FaceScanResult {
  final AgeCategory category;
  final double confidence;
  final String description;
  final Rect? boundingBox;
  final double? headEulerAngleY;

  /// True when the live frame is good enough to be worth capturing a still
  /// from. Only ever set by [checkFrame]; the age decision itself is made
  /// from the captured still, never from a streamed preview frame.
  final bool readyForCapture;

  const FaceScanResult({
    required this.category,
    required this.confidence,
    required this.description,
    this.boundingBox,
    this.headEulerAngleY,
    this.readyForCapture = false,
  });

  bool get isChild => category == AgeCategory.child;
}

/// Face scanning, in two clearly separated halves.
///
/// **ML Kit does what ML Kit is genuinely good at** — finding a face, giving
/// a tight box, head pose, landmarks and eye-open probabilities. Google is
/// right that it is excellent at that. What it does not do, and has never
/// claimed to do, is estimate age; there is no age API in ML Kit at all.
/// This class previously tried to bridge that gap with four hand-picked
/// ratios between ML Kit's landmarks, and its own code comment admitted the
/// thresholds were "chosen by inspection rather than fit to any labelled
/// dataset". They behaved accordingly — first refusing to decide anything at
/// all, then classifying an adult as a child.
///
/// **A real trained model does the age part.** See AgeModelService: FairFace,
/// CC BY 4.0, running on-device. ML Kit feeds it a clean, well-framed crop;
/// the model returns actual age-bucket probabilities.
///
/// The split also fixes a structural mistake. The old code tried to judge age
/// from streamed preview frames, which are noisy, rotated, and in a colour
/// format that has to be reassembled by hand. Now the preview stream is used
/// ONLY to decide when the shot is good — face present, big enough, facing
/// forward, eyes open, bright enough — and the age estimate runs once, on a
/// proper still capture, in a single unambiguous coordinate space.
///
/// Nothing here is a security boundary. Per app/api/content-access/route.ts
/// the only locked transition in this system is turning 18+ content ON, which
/// needs the 6-digit passkey regardless of what this returns.
class FaceAgeDetectorService {
  FaceDetector? _streamDetector;
  FaceDetector? _stillDetector;

  /// Fast detector for the live preview: it only has to answer "is there a
  /// usable face in shot right now", many times a second.
  FaceDetector _getStreamDetector() {
    return _streamDetector ??= FaceDetector(
      options: FaceDetectorOptions(
        enableLandmarks: true,
        // Eye-open probability is a real, trained ML Kit signal and a much
        // better quality gate than anything derivable from landmarks by
        // hand: it rejects blinks and half-closed eyes, which are exactly
        // the frames that produce a bad crop.
        enableClassification: true,
        enableContours: false,
        performanceMode: FaceDetectorMode.fast,
        minFaceSize: 0.20,
      ),
    );
  }

  /// Accurate detector for the one still capture. It runs once, so the extra
  /// cost buys a noticeably better-fitting box — which matters, because that
  /// box becomes the model's input.
  FaceDetector _getStillDetector() {
    return _stillDetector ??= FaceDetector(
      options: FaceDetectorOptions(
        enableLandmarks: true,
        enableClassification: true,
        enableContours: false,
        performanceMode: FaceDetectorMode.accurate,
        minFaceSize: 0.15,
      ),
    );
  }

  /// Mean luminance (0-255) below which a frame is treated as too dark.
  /// ML Kit will still happily FIND a face in near-darkness — it just cannot
  /// place anything precisely enough for the result to mean much, and the
  /// model would be reading mud.
  static const double minUsableBrightness = 60.0;

  /// Below this, an eye is closed enough that the crop is not worth taking.
  static const double minEyeOpenProbability = 0.35;

  /// The band around the decision where the model is not committing. Inside
  /// it, no answer is given and the caller keeps looking.
  ///
  /// This exists mainly to absorb quantisation drift. The int8 model differs
  /// from the original by up to ~0.11 in logit space; a band this wide makes
  /// that difference incapable of changing the outcome, because anything
  /// close enough to be flipped by it is refused rather than decided.
  static const double childDecisionThreshold = 0.65;
  static const double adultDecisionThreshold = 0.35;

  /// Live-preview gate. Deliberately never returns an age — it only reports
  /// whether this frame is worth capturing a still from.
  Future<FaceScanResult> checkFrame(
    InputImage inputImage, {
    double? frameBrightness,
  }) async {
    try {
      if (frameBrightness != null && frameBrightness < minUsableBrightness) {
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0.0,
          description: 'Too dark — find better light',
        );
      }

      final faces = await _getStreamDetector().processImage(inputImage);
      if (faces.isEmpty) {
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0.0,
          description: 'No face detected. Align your face.',
        );
      }

      final face = faces.first;
      final box = face.boundingBox;

      if (box.width < 140 || box.height < 140) {
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0.0,
          description: 'Move closer to the camera.',
        );
      }

      final yaw = (face.headEulerAngleY ?? 0).abs();
      final roll = (face.headEulerAngleZ ?? 0).abs();
      if (yaw > 22 || roll > 25) {
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0.0,
          description: 'Look straight at the camera.',
        );
      }

      final leftOpen = face.leftEyeOpenProbability;
      final rightOpen = face.rightEyeOpenProbability;
      if (leftOpen != null &&
          rightOpen != null &&
          (leftOpen < minEyeOpenProbability ||
              rightOpen < minEyeOpenProbability)) {
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0.0,
          description: 'Open your eyes and hold still.',
        );
      }

      return FaceScanResult(
        category: AgeCategory.unknown,
        confidence: 0.0,
        description: 'Hold still',
        boundingBox: box,
        headEulerAngleY: face.headEulerAngleY,
        readyForCapture: true,
      );
    } catch (e) {
      debugPrint('[FaceAgeDetector] frame check failed: $e');
      return const FaceScanResult(
        category: AgeCategory.unknown,
        confidence: 0.0,
        description: 'Scan failed. Please retry.',
      );
    }
  }

  /// The real estimate, made once from a still capture.
  ///
  /// Everything happens in one coordinate space: ML Kit locates the face in
  /// the same decoded JPEG the crop is taken from, so there is no rotation or
  /// YUV-layout arithmetic to get subtly wrong — which is the usual way a
  /// pipeline like this ends up feeding the model a crop of someone's ear.
  Future<FaceScanResult> estimateFromImageFile(String path) async {
    try {
      final loaded = await AgeModelService.instance.ensureLoaded();
      if (!loaded) {
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0.0,
          description: "Age check isn't available on this device.",
        );
      }

      final faces =
          await _getStillDetector().processImage(InputImage.fromFilePath(path));
      if (faces.isEmpty) {
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0.0,
          description: 'No face detected. Align your face.',
        );
      }

      // Largest face, not first — if someone else is in shot behind you, the
      // one filling the frame is the one being scanned.
      Face face = faces.first;
      for (final candidate in faces) {
        if (candidate.boundingBox.width * candidate.boundingBox.height >
            face.boundingBox.width * face.boundingBox.height) {
          face = candidate;
        }
      }

      final bytes = await File(path).readAsBytes();
      final decoded = img.decodeImage(bytes);
      if (decoded == null) {
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0.0,
          description: 'Scan failed. Please retry.',
        );
      }

      final crop = _cropFace(decoded, face.boundingBox);
      if (crop == null) {
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0.0,
          description: 'Center your face and try again.',
        );
      }

      final estimate = AgeModelService.instance.estimate(crop);
      if (estimate == null) {
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0.0,
          description: 'Scan failed. Please retry.',
        );
      }

      final p = estimate.childProbability;
      if (p >= childDecisionThreshold) {
        return FaceScanResult(
          category: AgeCategory.child,
          confidence: p,
          description: 'Estimated younger than 13',
          boundingBox: face.boundingBox,
          headEulerAngleY: face.headEulerAngleY,
        );
      }
      if (p <= adultDecisionThreshold) {
        return FaceScanResult(
          category: AgeCategory.teenOrAdult,
          confidence: 1.0 - p,
          description: 'Estimated 13 or older',
          boundingBox: face.boundingBox,
          headEulerAngleY: face.headEulerAngleY,
        );
      }

      // Genuinely borderline. Saying so is the honest outcome — the caller
      // asks rather than guessing.
      return FaceScanResult(
        category: AgeCategory.unknown,
        confidence: 0.0,
        description: "Couldn't tell for sure",
        boundingBox: face.boundingBox,
        headEulerAngleY: face.headEulerAngleY,
      );
    } catch (e) {
      debugPrint('[FaceAgeDetector] still estimate failed: $e');
      return const FaceScanResult(
        category: AgeCategory.unknown,
        confidence: 0.0,
        description: 'Scan failed. Please retry.',
      );
    }
  }

  /// Square crop with ~25% padding around ML Kit's box.
  ///
  /// The padding is not arbitrary: the FairFace weights bundled here are the
  /// "align" variant, trained on dlib-aligned crops that include roughly this
  /// much surrounding head. Feeding a face cropped tight to the eyebrows and
  /// chin is a different input distribution from the one it learnt on, and
  /// the model gets quietly worse rather than obviously wrong.
  img.Image? _cropFace(img.Image source, Rect box) {
    final centerX = box.center.dx;
    final centerY = box.center.dy;
    final side = (box.width > box.height ? box.width : box.height) * 1.5;
    if (side <= 1) return null;

    var left = (centerX - side / 2).round();
    var top = (centerY - side / 2).round();
    var size = side.round();

    // Clamp inside the image without letting the crop go non-square: shrink
    // it instead of sliding it, so the face stays centred.
    if (left < 0) {
      size += left;
      left = 0;
    }
    if (top < 0) {
      size += top;
      top = 0;
    }
    if (left + size > source.width) size = source.width - left;
    if (top + size > source.height) size = source.height - top;
    if (size < 40) return null;

    return img.copyCrop(source, x: left, y: top, width: size, height: size);
  }

  void dispose() {
    _streamDetector?.close();
    _streamDetector = null;
    _stillDetector?.close();
    _stillDetector = null;
  }
}
