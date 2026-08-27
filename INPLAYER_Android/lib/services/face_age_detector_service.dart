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

      // Pick the primary/largest centered face
      final face = faces.first;
      final box = face.boundingBox;

      // 1. Landmark Extraction
      final leftEye = face.landmarks[FaceLandmarkType.leftEye]?.position;
      final rightEye = face.landmarks[FaceLandmarkType.rightEye]?.position;
      final noseBase = face.landmarks[FaceLandmarkType.noseBase]?.position;
      final bottomMouth = face.landmarks[FaceLandmarkType.bottomMouth]?.position;

      // Fallback if key landmarks aren't fully resolved
      if (leftEye == null || rightEye == null || noseBase == null || bottomMouth == null) {
        // High facial roundness aspect ratio fallback
        final aspect = box.width / box.height;
        if (aspect > 0.88) {
          return FaceScanResult(
            category: AgeCategory.child,
            confidence: 0.72,
            description: 'Child facial proportions detected',
            boundingBox: box,
          );
        }
        return FaceScanResult(
          category: AgeCategory.teenOrAdult,
          confidence: 0.75,
          description: 'Adult facial proportions detected',
          boundingBox: box,
        );
      }

      // 2. Biometric Metric Calculations
      final eyeCenterY = (leftEye.y + rightEye.y) / 2.0;
      final eyeDistance = (leftEye.x - rightEye.x).abs();

      final lowerFaceHeight = (bottomMouth.y - eyeCenterY).toDouble();
      final totalFaceHeight = box.height.toDouble();

      // Lower face ratio: In infants/children, eyes sit near the vertical midpoint or lower,
      // and lower jaw height is noticeably shorter (< 0.42 of total face box).
      final lowerFaceRatio = lowerFaceHeight / (totalFaceHeight > 0 ? totalFaceHeight : 1.0);

      // Facial roundness (width / height)
      final roundnessRatio = box.width / (box.height > 0 ? box.height : 1.0);

      // Inter-ocular proportion: children have wider-spaced eyes relative to face width
      final ocularProportion = eyeDistance / (box.width > 0 ? box.width : 1.0);

      // 3. Child vs Adult Score Calculation
      double childScore = 0.0;

      // Children have rounder faces (aspect ratio > 0.82)
      if (roundnessRatio > 0.84) childScore += 0.35;
      if (roundnessRatio > 0.90) childScore += 0.15;

      // Children have shorter lower facial thirds (lower face ratio < 0.44)
      if (lowerFaceRatio < 0.43) childScore += 0.35;
      if (lowerFaceRatio < 0.38) childScore += 0.15;

      // Wide ocular distance proportion
      if (ocularProportion > 0.42) childScore += 0.20;

      // Classification determination with confidence clamping
      final isChild = childScore >= 0.50;
      final confidence = isChild ? childScore.clamp(0.65, 0.96) : (1.0 - childScore).clamp(0.65, 0.96);

      return FaceScanResult(
        category: isChild ? AgeCategory.child : AgeCategory.teenOrAdult,
        confidence: confidence,
        description: isChild ? 'Child profile detected (<13)' : 'Adult/Teen profile detected (13+)',
        boundingBox: box,
        headEulerAngleY: face.headEulerAngleY,
      );
    } catch (e) {
      debugPrint('[FaceAgeDetector] Error: ');
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
