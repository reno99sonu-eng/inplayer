import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../providers/kid_mode_provider.dart';
import '../../../../services/face_age_detector_service.dart';
import 'parental_pin_dialog.dart';

class FaceScanModal extends ConsumerStatefulWidget {
  const FaceScanModal({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const FaceScanModal(),
    );
  }

  @override
  ConsumerState<FaceScanModal> createState() => _FaceScanModalState();
}

class _FaceScanModalState extends ConsumerState<FaceScanModal> with SingleTickerProviderStateMixin {
  CameraController? _cameraController;
  late FaceAgeDetectorService _ageDetector;
  late AnimationController _scannerAnim;

  bool _isInitializing = true;
  bool _isProcessing = false;
  bool _hasPermissionError = false;
  FaceScanResult? _scanResult;
  String _statusText = 'Center your face in the circle';

  @override
  void initState() {
    super.initState();
    _ageDetector = FaceAgeDetectorService();
    _scannerAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

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
      debugPrint('[FaceScanModal] Camera init error: ');
      if (mounted) {
        setState(() {
          _isInitializing = false;
          _hasPermissionError = true;
        });
      }
    }
  }

  void _startLiveStreamAnalysis() {
    if (_cameraController == null || !_cameraController!.value.isInitialized) return;

    _cameraController!.startImageStream((CameraImage image) {
      if (_isProcessing || _scanResult != null) return;
      _isProcessing = true;

      _processCameraImage(image).then((result) {
        if (result != null && mounted) {
          if (result.category != AgeCategory.unknown) {
            setState(() {
              _scanResult = result;
              _statusText = result.isChild ? 'Child Detected (<13)' : 'Adult/Teen Detected (13+)';
            });
            _onScanComplete(result);
          }
        }
      }).whenComplete(() {
        _isProcessing = false;
      });
    });
  }

  Future<FaceScanResult?> _processCameraImage(CameraImage image) async {
    try {
      final WriteBuffer allBytes = WriteBuffer();
      for (final Plane plane in image.planes) {
        allBytes.putUint8List(plane.bytes);
      }
      final bytes = allBytes.done().buffer.asUint8List();

      final Size imageSize = Size(image.width.toDouble(), image.height.toDouble());
      final camera = _cameraController!.description;
      final imageRotation = InputImageRotationValue.fromRawValue(camera.sensorOrientation) ??
          InputImageRotation.rotation0deg;
      final inputImageFormat = InputImageFormatValue.fromRawValue(image.format.raw) ??
          InputImageFormat.nv21;

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
    HapticFeedback.mediumImpact();
    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;

    final notifier = ref.read(kidModeProvider.notifier);
    if (result.isChild) {
      await notifier.setKidMode(true);
    } else {
      await notifier.setKidMode(false);
    }

    if (mounted) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: result.isChild ? const Color(0xFF10B981) : AppColors.brandOrange,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          content: Row(
            children: [
              Icon(
                result.isChild ? Icons.child_care_rounded : Icons.verified_user_rounded,
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

  @override
  void dispose() {
    _cameraController?.dispose();
    _ageDetector.dispose();
    _scannerAnim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;

    return Container(
      padding: const EdgeInsets.only(top: 16, bottom: 32, left: 24, right: 24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0B111E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        border: Border(top: BorderSide(color: context.borderSubtle, width: 1.5)),
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
                onPressed: () => Navigator.of(context).pop(),
                icon: Icon(Icons.close_rounded, color: context.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '100% on-device neural processing. No pictures or biometric data leave your phone.',
            style: TextStyle(color: context.textSecondary, fontSize: 12, height: 1.3),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 28),
          // Holographic Camera / Scanner Circle
          _buildScannerPreview(context),
          const SizedBox(height: 24),
          // Status indicator
          _buildStatusBadge(context),
          const SizedBox(height: 16),
          // Manual Fallback Toggle
          TextButton.icon(
            onPressed: () {
              Navigator.of(context).pop();
              final currentKid = ref.read(kidModeProvider).isEnabled;
              if (currentKid) {
                // Prompt PIN to exit
                ParentalPinDialog.show(context);
              } else {
                // Directly switch to Kids Mode
                ref.read(kidModeProvider.notifier).setKidMode(true);
              }
            },
            icon: const Icon(Icons.pin_outlined, size: 16),
            label: const Text(
              'Switch mode with Parental PIN instead',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
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
              style: TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ),
      );
    }

    if (_isInitializing || _cameraController == null || !_cameraController!.value.isInitialized) {
      return Container(
        width: 220,
        height: 220,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: context.bgCard,
          border: Border.all(color: context.borderSubtle, width: 2),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: AppColors.brandOrange, strokeWidth: 2.5),
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
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandOrange),
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
