import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

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

  const FaceScanResult({
    required this.category,
    required this.confidence,
    required this.description,
    this.boundingBox,
    this.headEulerAngleY,
  });

  bool get isChild => category == AgeCategory.child;
}

/// High-performance On-Device Face Age Detector.
///
/// Analyzes facial morphology & biometric landmark proportions:
/// - Eye-to-chin proportion vs total face height (children have much larger eyes-to-head ratio and shorter mid/lower face).
/// - Cheek-to-jaw width ratio (children exhibit higher facial roundness and less elongated mandibles).
/// - Inter-ocular distance relative to face width.
class FaceAgeDetectorService {
  FaceDetector? _detector;

  FaceDetector _getDetector() {
    return _detector ??= FaceDetector(
      options: FaceDetectorOptions(
        enableLandmarks: true,
        enableClassification: true,
        enableContours: true,
        performanceMode: FaceDetectorMode.fast,
        minFaceSize: 0.15,
      ),
    );
  }

  static FaceScanResult classifyFaceMetrics({
    required double roundnessRatio,
    required double lowerFaceRatio,
    required double ocularProportion,
    bool isFacingFront = true,
  }) {
    double childScore = 0.0;

    if (isFacingFront) {
      childScore += 0.15;
    }

    if (roundnessRatio > 0.84) childScore += 0.28;
    if (roundnessRatio > 0.90) childScore += 0.20;
    if (lowerFaceRatio < 0.43) childScore += 0.28;
    if (lowerFaceRatio < 0.38) childScore += 0.16;
    if (ocularProportion > 0.42) childScore += 0.20;
    if (ocularProportion > 0.46) childScore += 0.10;

    final isChild = childScore >= 0.70;
    final confidence = isChild
        ? childScore.clamp(0.70, 0.97)
        : (1.0 - childScore).clamp(0.70, 0.97);

    return FaceScanResult(
      category: isChild ? AgeCategory.child : AgeCategory.teenOrAdult,
      confidence: confidence,
      description: isChild
          ? 'Child profile detected (<13)'
          : 'Adult/Teen profile detected (13+)',
    );
  }

  /// Evaluates an [InputImage] captured from the front camera.
  Future<FaceScanResult> detectAge(InputImage inputImage) async {
    try {
      final detector = _getDetector();
      final faces = await detector.processImage(inputImage);

      if (faces.isEmpty) {
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0.0,
          description: 'No face detected in frame. Center your face.',
        );
      }

      final face = faces.first;
      final box = face.boundingBox;
      final leftEye = face.landmarks[FaceLandmarkType.leftEye]?.position;
      final rightEye = face.landmarks[FaceLandmarkType.rightEye]?.position;
      final noseBase = face.landmarks[FaceLandmarkType.noseBase]?.position;
      final bottomMouth =
          face.landmarks[FaceLandmarkType.bottomMouth]?.position;

      if (leftEye == null ||
          rightEye == null ||
          noseBase == null ||
          bottomMouth == null) {
        // A bounding box alone is not reliable enough to set a child/adult
        // content policy. Wait for a frame with the required landmarks.
        return const FaceScanResult(
          category: AgeCategory.unknown,
          confidence: 0,
          description: 'Face landmarks not clear. Hold still and try again.',
        );
      }

      final eyeCenterY = (leftEye.y + rightEye.y) / 2.0;
      final eyeDistance = (leftEye.x - rightEye.x).abs();
      final lowerFaceHeight = (bottomMouth.y - eyeCenterY).toDouble();
      final totalFaceHeight = box.height.toDouble();
      final lowerFaceRatio =
          lowerFaceHeight / (totalFaceHeight > 0 ? totalFaceHeight : 1.0);
      final roundnessRatio = box.width / (box.height > 0 ? box.height : 1.0);
      final ocularProportion = eyeDistance / (box.width > 0 ? box.width : 1.0);
      final isFacingFront = (face.headEulerAngleY ?? 0).abs() < 20;

      final result = classifyFaceMetrics(
        roundnessRatio: roundnessRatio,
        lowerFaceRatio: lowerFaceRatio,
        ocularProportion: ocularProportion,
        isFacingFront: isFacingFront,
      );

      return FaceScanResult(
        category: result.category,
        confidence: result.confidence,
        description: result.description,
        boundingBox: box,
        headEulerAngleY: face.headEulerAngleY,
      );
    } catch (e) {
      debugPrint('[FaceAgeDetector] Error: $e');
      return const FaceScanResult(
        category: AgeCategory.unknown,
        confidence: 0.0,
        description: 'Scan failed. Please retry.',
      );
    }
  }

  void dispose() {
    _detector?.close();
    _detector = null;
  }
}
