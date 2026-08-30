import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../services/face_age_detector_service.dart';

class FaceScanModal extends ConsumerStatefulWidget {
  final bool startupScan;

  const FaceScanModal({super.key, this.startupScan = false});

  static Future<FaceScanResult?> show(
    BuildContext context, {
    bool startupScan = false,
  }) {
    if (!startupScan) {
      return showModalBottomSheet<FaceScanResult?>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (ctx) => const FaceScanModal(),
      );
    }

    // Startup mode is a real gate: the feed stays behind an opaque barrier
    // until the scanner returns a result (or the user explicitly chooses the
    // safe fallback). Keep the camera sheet as one route so its controller is
    // disposed before the startup code changes providers.
    return showGeneralDialog<FaceScanResult?>(
      context: context,
      useRootNavigator: true,
      barrierDismissible: false,
      barrierLabel: 'InPlayer age safety scan',
      barrierColor: Colors.black.withValues(alpha: .96),
      transitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (dialogContext, animation, secondaryAnimation) {
        return SafeArea(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: FractionallySizedBox(
              widthFactor: 1,
              child: FaceScanModal(startupScan: true),
            ),
          ),
        );
      },
      transitionBuilder: (context, animation, secondaryAnimation, child) {
        return FadeTransition(opacity: animation, child: child);
      },
    );
  }

  @override
  ConsumerState<FaceScanModal> createState() => _FaceScanModalState();
}

class _FaceScanModalState extends ConsumerState<FaceScanModal>
    with SingleTickerProviderStateMixin {
  CameraController? _cameraController;
  late FaceAgeDetectorService _ageDetector;
  late AnimationController _scannerAnim;

  bool _isInitializing = true;
  bool _isProcessing = false;
  bool _hasPermissionError = false;
  FaceScanResult? _scanResult;
  AgeCategory _candidateCategory = AgeCategory.unknown;
  int _candidateFrames = 0;
  double _candidateConfidence = 0;
  Timer? _startupTimeout;
  String _statusText = 'Center your face in the circle';

  @override
  void initState() {
    super.initState();
    _ageDetector = FaceAgeDetectorService();
    _scannerAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    if (widget.startupScan) {
      // A camera/model that is unavailable must never leave the launch screen
      // black indefinitely. Give the scan a generous window, then continue
      // with the safe family filter.
      // ML Kit can download/initialise its on-device model on the first run.
      // Eight seconds was too short on real devices and closed the scanner
      // before the first usable frame arrived. Keep the gate open long enough
      // for cold starts while still guaranteeing a safe fallback.
      _startupTimeout = Timer(const Duration(seconds: 30), () {
        if (!mounted || _scanResult != null) return;
        unawaited(_finishStartupFallback());
      });
    }

    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      final frontCamera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      _cameraController = CameraController(
        frontCamera,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.nv21,
      );

      await _cameraController!.initialize();
      if (!mounted) return;

      setState(() => _isInitializing = false);
      _startLiveStreamAnalysis();
    } catch (e) {
      debugPrint('[FaceScanModal] Camera init error: $e');
      if (mounted) {
        setState(() {
          _isInitializing = false;
          _hasPermissionError = true;
        });
      }
    }
  }

  void _startLiveStreamAnalysis() {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }

    _cameraController!.startImageStream((CameraImage image) {
      if (_isProcessing || _scanResult != null) return;
      _isProcessing = true;

      _processCameraImage(image)
          .then((result) {
            if (result != null && mounted) {
              if (result.category != AgeCategory.unknown &&
                  result.confidence >= .75) {
                if (result.category == _candidateCategory) {
                  _candidateFrames++;
                  _candidateConfidence += result.confidence;
                } else {
                  _candidateCategory = result.category;
                  _candidateFrames = 1;
                  _candidateConfidence = result.confidence;
                }
                if (_candidateFrames < 4) {
                  setState(
                    () => _statusText =
                        'Hold still… checking $_candidateFrames/4',
                  );
                  return;
                }
                final stableResult = FaceScanResult(
                  category: _candidateCategory,
                  confidence: _candidateConfidence / _candidateFrames,
                  description: result.description,
                  boundingBox: result.boundingBox,
                  headEulerAngleY: result.headEulerAngleY,
                );
                setState(() {
                  _scanResult = stableResult;
                  _statusText = stableResult.isChild
                      ? 'Child Detected (<13)'
                      : 'Adult/Teen Detected (13+)';
                });
                _onScanComplete(stableResult);
              }
            }
          })
          .whenComplete(() {
            _isProcessing = false;
          });
    });
  }

  Future<FaceScanResult?> _processCameraImage(CameraImage image) async {
    try {
      // With ImageFormatGroup.nv21 Android normally supplies one packed
      // plane. Concatenating all planes (the old implementation) produced an
      // invalid image for ML Kit on several camera2 devices, so no face was
      // ever reported. Handle both packed NV21 and YUV_420_888 safely.
      final Uint8List bytes;
      if (image.planes.length == 1) {
        bytes = image.planes.first.bytes;
      } else {
        final y = image.planes[0];
        final u = image.planes[1];
        final v = image.planes[2];
        final output = Uint8List(
          y.bytes.length + u.bytes.length + v.bytes.length,
        );
        output.setRange(0, y.bytes.length, y.bytes);
        var offset = y.bytes.length;
        // NV21 is Y + interleaved VU. Respect pixel stride for YUV_420_888.
        final pixelStride = u.bytesPerPixel ?? 1;
        for (var i = 0; i < u.bytes.length; i += pixelStride) {
          output[offset++] =
              v.bytes[i < v.bytes.length ? i : v.bytes.length - 1];
          output[offset++] = u.bytes[i];
        }
        bytes = output.sublist(0, offset);
      }

      final Size imageSize = Size(
        image.width.toDouble(),
        image.height.toDouble(),
      );
      final camera = _cameraController!.description;
      final imageRotation =
          InputImageRotationValue.fromRawValue(camera.sensorOrientation) ??
          InputImageRotation.rotation0deg;
      final inputImageFormat = image.planes.length == 1
          ? (InputImageFormatValue.fromRawValue(image.format.raw) ??
                InputImageFormat.nv21)
          : InputImageFormat.nv21;

      final inputImage = InputImage.fromBytes(
        bytes: bytes,
        metadata: InputImageMetadata(
          size: imageSize,
          rotation: imageRotation,
          format: inputImageFormat,
          bytesPerRow: image.planes[0].bytesPerRow,
        ),
      );

      return await _ageDetector.detectAge(inputImage);
    } catch (e) {
      return null;
    }
  }

  Future<void> _onScanComplete(FaceScanResult result) async {
    _startupTimeout?.cancel();
    HapticFeedback.mediumImpact();
    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;

    if (mounted) {
      Navigator.of(context, rootNavigator: true).pop(result);
      if (!widget.startupScan && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: result.isChild
                ? const Color(0xFF10B981)
                : AppColors.brandOrange,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            content: Row(
              children: [
                Icon(
                  result.isChild
                      ? Icons.child_care_rounded
                      : Icons.verified_user_rounded,
                  color: Colors.white,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    result.isChild
                        ? 'InPlayer Kids Safety Mode is now ACTIVE'
                        : 'Standard Adult Mode Verified',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _startupTimeout?.cancel();
    _cameraController?.dispose();
    _ageDetector.dispose();
    _scannerAnim.dispose();
    super.dispose();
  }

  Future<void> _finishStartupFallback() async {
    try {
      if (_cameraController?.value.isStreamingImages == true) {
        await _cameraController!.stopImageStream();
      }
    } catch (_) {}
    if (mounted) Navigator.of(context, rootNavigator: true).pop();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;

    return Container(
      padding: const EdgeInsets.only(top: 16, bottom: 32, left: 24, right: 24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0B111E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        border: Border(
          top: BorderSide(color: context.borderSubtle, width: 1.5),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: context.textDim.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Face ID Age Verification',
                style: TextStyle(
                  color: context.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              IconButton(
                onPressed: () =>
                    Navigator.of(context, rootNavigator: true).pop(),
                icon: Icon(Icons.close_rounded, color: context.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '100% on-device neural processing. No pictures or biometric data leave your phone.',
            style: TextStyle(
              color: context.textSecondary,
              fontSize: 12,
              height: 1.3,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 28),
          // Holographic Camera / Scanner Circle
          _buildScannerPreview(context),
          const SizedBox(height: 24),
          // Status indicator
          _buildStatusBadge(context),
          const SizedBox(height: 16),
          // A face result is only a suggestion. The caller applies it through
          // the account's verified six-digit content passkey.
          TextButton.icon(
            onPressed: () => Navigator.of(context, rootNavigator: true).pop(),
            icon: const Icon(Icons.close_rounded, size: 16),
            label: const Text(
              'Cancel scan',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
          if (widget.startupScan && _hasPermissionError)
            TextButton(
              onPressed: () => Navigator.of(context, rootNavigator: true).pop(),
              child: const Text('Continue with safer restricted mode'),
            ),
        ],
      ),
    );
  }

  Widget _buildScannerPreview(BuildContext context) {
    if (_hasPermissionError) {
      return Container(
        width: 220,
        height: 220,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.red.withValues(alpha: 0.1),
          border: Border.all(color: Colors.redAccent, width: 2),
        ),
        child: const Center(
          child: Padding(
            padding: EdgeInsets.all(20.0),
            child: Text(
              'Camera access required for Face ID.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.redAccent,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      );
    }

    if (_isInitializing ||
        _cameraController == null ||
        !_cameraController!.value.isInitialized) {
      return Container(
        width: 220,
        height: 220,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: context.bgCard,
          border: Border.all(color: context.borderSubtle, width: 2),
        ),
        child: const Center(
          child: CircularProgressIndicator(
            color: AppColors.brandOrange,
            strokeWidth: 2.5,
          ),
        ),
      );
    }

    final isChild = _scanResult?.isChild ?? false;
    final ringColor = _scanResult != null
        ? (isChild ? const Color(0xFF10B981) : AppColors.brandOrange)
        : AppColors.brandOrange;

    return Stack(
      alignment: Alignment.center,
      children: [
        // Camera circular cutout
        Container(
          width: 230,
          height: 230,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ringColor, width: 3),
            boxShadow: [
              BoxShadow(
                color: ringColor.withValues(alpha: 0.25),
                blurRadius: 20,
                spreadRadius: 4,
              ),
            ],
          ),
          child: ClipOval(
            child: OverflowBox(
              alignment: Alignment.center,
              child: FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: _cameraController!.value.previewSize?.height ?? 230,
                  height: _cameraController!.value.previewSize?.width ?? 230,
                  child: CameraPreview(_cameraController!),
                ),
              ),
            ),
          ),
        ),
        // Laser sweep animation when scanning
        if (_scanResult == null)
          AnimatedBuilder(
            animation: _scannerAnim,
            builder: (context, child) {
              return Positioned(
                top: 20 + (_scannerAnim.value * 190),
                child: Container(
                  width: 210,
                  height: 2,
                  decoration: BoxDecoration(
                    color: AppColors.brandOrange,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.brandOrange.withValues(alpha: 0.9),
                        blurRadius: 8,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
      ],
    );
  }

  Widget _buildStatusBadge(BuildContext context) {
    final result = _scanResult;
    final isChild = result?.isChild ?? false;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      decoration: BoxDecoration(
        color: result != null
            ? (isChild ? const Color(0x2210B981) : const Color(0x22F97316))
            : context.bgCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: result != null
              ? (isChild ? const Color(0xFF10B981) : AppColors.brandOrange)
              : context.borderSubtle,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (result == null)
            const SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.brandOrange,
              ),
            )
          else
            Icon(
              isChild ? Icons.child_care_rounded : Icons.check_circle_rounded,
              color: isChild ? const Color(0xFF10B981) : AppColors.brandOrange,
              size: 16,
            ),
          const SizedBox(width: 8),
          Text(
            _statusText,
            style: TextStyle(
              color: result != null
                  ? (isChild ? const Color(0xFF10B981) : AppColors.brandOrange)
                  : context.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
