import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../../core/router/app_router.dart';
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
    final targetContext = rootNavigatorKey.currentContext ?? context;
    if (!startupScan) {
      return showGeneralDialog<FaceScanResult?>(
        context: targetContext,
        useRootNavigator: true,
        barrierDismissible: true,
        barrierLabel: 'InPlayer face scan',
        barrierColor: Colors.black.withValues(alpha: .7),
        transitionDuration: const Duration(milliseconds: 250),
        pageBuilder: (dialogContext, animation, secondaryAnimation) {
          return const FaceScanModal();
        },
        transitionBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      );
    }

    return showGeneralDialog<FaceScanResult?>(
      context: targetContext,
      useRootNavigator: true,
      barrierDismissible: false,
      barrierLabel: 'InPlayer age safety scan',
      barrierColor: Colors.black.withValues(alpha: .96),
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (dialogContext, animation, secondaryAnimation) {
        return const FaceScanModal(startupScan: true);
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
    with TickerProviderStateMixin {
  CameraController? _cameraController;
  late FaceAgeDetectorService _ageDetector;
  late AnimationController _pulseAnim;
  late AnimationController _scanLineAnim;
  late AnimationController _cornerAnim;
  // Slow continuous rotation behind the scanner frame — purely decorative
  // (the "ultra premium" shimmer ring), not tied to any detection state.
  late AnimationController _shimmerAnim;

  bool _isInitializing = true;
  bool _isProcessing = false;
  bool _hasPermissionError = false;
  FaceScanResult? _scanResult;

  /// Consecutive live frames that passed every quality gate. The age
  /// estimate is NOT made from these — they only decide when the shot is
  /// good enough to be worth capturing a still from.
  int _candidateFrames = 0;

  /// True while the still capture and model run are in flight, so the image
  /// stream can't fire a second capture underneath the first.
  bool _capturing = false;
  Timer? _startupTimeout;
  int _unknownFrameCount = 0;
  bool _isAnalyzing = false;

  // Phase text — kept short by design: this is a compact bottom card, not
  // a full page, so copy stays to a title line plus a short caption.
  String _statusText = 'Align your face';
  String _subtitleText = 'Hold steady';

  @override
  void initState() {
    super.initState();
    _ageDetector = FaceAgeDetectorService();

    _pulseAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _scanLineAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _cornerAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _shimmerAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3200),
    )..repeat();

    if (widget.startupScan) {
      // The gate stays SHUT when a scan does not complete.
      //
      // This timer used to call _finishStartupFallback(), which popped the
      // modal and let the person straight into the app on the family
      // default. That made the whole check optional: sit still for thirty
      // seconds, show no face at all, and you were in. Now it only raises a
      // "couldn't read a face" state with a Try Again button, so getting
      // past this screen requires an actual successful scan.
      //
      // The genuine no-camera-hardware case is unaffected — see _initCamera,
      // which still falls through gracefully, because a device with no
      // camera can never satisfy the scan and must not be bricked by it.
      _startupTimeout = Timer(const Duration(seconds: 20), () {
        if (!mounted || _scanResult != null) return;
        setState(() => _scanTimedOut = true);
      });
    }

    _initCamera();
  }

  /// Set once a camera permission request has actually come back denied (as
  /// opposed to just not having been asked yet) — distinguishes "still
  /// initializing" from "denied, needs Try Again / Open Settings" so the
  /// mandatory-mode UI knows which state it's really in.
  bool _permissionDenied = false;

  /// True once camera hardware enumeration comes back empty — a device
  /// fact (no camera present), never a consent choice. Kept separate from
  /// _permissionDenied so the UI never offers "Open Settings" for a problem
  /// settings can't fix, and so a startup scan on such a device is never
  /// treated as if someone tapped "Don't Allow" — see the check at the top
  /// of _initCamera below.
  bool _noCameraHardware = false;

  /// Set when the scan has run for a while without a confident read. Shows a
  /// retry prompt instead of letting the person through — see the timer in
  /// initState for why this is not a fallback into the app.
  bool _scanTimedOut = false;

  Future<void> _initCamera({bool retry = false}) async {
    if (retry && mounted) {
      setState(() {
        _isInitializing = true;
        _hasPermissionError = false;
        _permissionDenied = false;
        _noCameraHardware = false;
        _scanTimedOut = false;
        _statusText = 'Align your face';
        _subtitleText = 'Hold steady';
      });
      // Give the retry a fresh window before it reports failure again.
      _startupTimeout?.cancel();
      if (widget.startupScan) {
        _startupTimeout = Timer(const Duration(seconds: 20), () {
          if (!mounted || _scanResult != null) return;
          setState(() => _scanTimedOut = true);
        });
      }
      _candidateFrames = 0;
      _capturing = false;
      _unknownFrameCount = 0;
      _isAnalyzing = false;
    }
    try {
      // Camera hardware enumeration (CameraManager.getCameraIdList() under
      // the hood) does not require the CAMERA runtime permission on Android
      // — it's a hardware-inventory call, not a capture call. Checking it
      // first, before Permission.camera is ever touched, lets a device that
      // simply has no camera be told apart automatically from a person who
      // was asked and tapped "Don't Allow". Only the second case is what
      // the mandatory block-on-denial behavior below is meant to cover —
      // nobody can "deny" access to hardware their device doesn't have.
      //
      // This is a real, Play-Store-reachable case, not just an emulator
      // curiosity: AndroidManifest.xml marks both camera features
      // android:required="false" specifically so cameraless devices can
      // install this app. But a single enumeration check can occasionally
      // come back empty even on a device that DOES have a camera, simply
      // because Android's camera service hasn't finished starting yet this
      // early in a cold boot — a brief, harmless-but-wrong false negative
      // that would skip a scan a ready camera could have done. Retrying a
      // few times a beat apart absorbs that race without adding any delay
      // to the common case (a camera that's already ready answers on the
      // very first try — this loop only ever costs time on a genuinely
      // cameraless device).
      List<CameraDescription> cameras = const [];
      const maxCameraCheckAttempts = 3;
      for (var attempt = 1; attempt <= maxCameraCheckAttempts; attempt++) {
        try {
          cameras = await availableCameras();
        } catch (e) {
          debugPrint(
            '[FaceScanModal] Camera enumeration error (attempt $attempt): $e',
          );
          cameras = const [];
        }
        if (cameras.isNotEmpty || attempt == maxCameraCheckAttempts) break;
        await Future.delayed(const Duration(milliseconds: 350));
        if (!mounted) return;
      }

      if (cameras.isEmpty) {
        if (widget.startupScan) {
          // No hardware to scan with, full stop — this is a device fact,
          // never a consent choice, so it must never land on the
          // permission-denied screen or its Try Again/Open Settings
          // buttons (neither would ever help). Fall through the same
          // This is now the ONLY way past this screen without a completed
          // scan, and deliberately so: a device with no camera can never
          // satisfy the check, and blocking it would lock the person out of
          // the app entirely. main.dart's existing
          // "result == null -> AudienceMode.family" fallback applies, so
          // they land on the safest content setting.
          //
          // An inconclusive scan on a device that DOES have a camera no
          // longer comes through here — it raises the retry state instead.
          unawaited(_finishStartupFallback());
          return;
        }
        if (mounted) {
          setState(() {
            _isInitializing = false;
            _hasPermissionError = true;
            _noCameraHardware = true;
          });
        }
        return;
      }

      var perm = await Permission.camera.status;
      if (!perm.isGranted) {
        // A permanently-denied permission won't show the OS dialog again on
        // request() — it just resolves denied immediately. Try Again in that
        // state has to route to Open App Settings instead of re-requesting.
        if (!perm.isPermanentlyDenied) {
          perm = await Permission.camera.request();
        }
        if (!perm.isGranted) {
          if (mounted) {
            setState(() {
              _isInitializing = false;
              _hasPermissionError = true;
              _permissionDenied = true;
            });
          }
          return;
        }
      }

      final frontCamera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      _cameraController = CameraController(
        frontCamera,
        // `high` gives a visibly sharper preview/scan than the previous
        // `medium` without the frame-time cost of `veryHigh`/`max`, which on
        // mid-range devices was enough to start dropping frames out of the
        // live ML Kit analysis loop below. Detection logic itself doesn't
        // care about resolution — it's isolated from this bump either way.
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.nv21,
      );

      await _cameraController!.initialize();
      if (!mounted) return;

      setState(() {
        _isInitializing = false;
        _hasPermissionError = false;
      });
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
      if (_isProcessing || _scanResult != null || _capturing) return;
      _isProcessing = true;

      _processCameraImage(image)
          .then((result) {
            if (!mounted || _capturing) return;

            // The live stream is a QUALITY GATE ONLY — it never decides an
            // age. Preview frames are noisy, rotated, and in a colour format
            // this file has to reassemble by hand, which is precisely the
            // wrong thing to judge someone's age from. All this asks is
            // whether the shot is good enough to capture.
            if (result == null || !result.readyForCapture) {
              _unknownFrameCount++;
              if (_unknownFrameCount > 2) {
                _candidateFrames = 0;
                final hint = result?.description ?? 'Align your face';
                if (mounted && (_isAnalyzing || _statusText != hint)) {
                  setState(() {
                    _isAnalyzing = false;
                    _statusText = hint;
                    _subtitleText = 'Hold steady';
                  });
                  _cornerAnim.reverse();
                }
              }
              return;
            }

            _unknownFrameCount = 0;
            _candidateFrames++;

            if (_candidateFrames < 5) {
              if (mounted && (!_isAnalyzing || _statusText != 'Verifying…')) {
                setState(() {
                  _isAnalyzing = true;
                  _statusText = 'Verifying…';
                  _subtitleText = '$_candidateFrames/5';
                });
                if (!_cornerAnim.isAnimating) _cornerAnim.forward();
              }
              return;
            }

            unawaited(_captureAndEstimate());
          })
          .whenComplete(() {
            _isProcessing = false;
          });
    });
  }

  /// Takes one still photo and runs the real age model on it.
  ///
  /// Deliberately one shot rather than something done per preview frame. A
  /// captured still comes back upright and correctly colour-converted by the
  /// camera plugin, and ML Kit then locates the face in the very same image
  /// the crop is taken from — so there is no rotation arithmetic and no YUV
  /// plane juggling between the box and the pixels. That is the usual way a
  /// pipeline like this quietly ends up feeding the model a crop of
  /// somebody's ear and then trusting the answer.
  Future<void> _captureAndEstimate() async {
    if (_capturing) return;
    _capturing = true;

    if (mounted) {
      setState(() {
        _isAnalyzing = true;
        _statusText = 'Reading…';
        _subtitleText = 'Hold still';
      });
    }

    String? shotPath;
    try {
      final controller = _cameraController;
      if (controller == null || !controller.value.isInitialized) return;

      // takePicture() and an active image stream cannot coexist on a lot of
      // Android devices — this throws on them rather than returning.
      if (controller.value.isStreamingImages) {
        await controller.stopImageStream();
      }

      final shot = await controller.takePicture();
      shotPath = shot.path;

      final result = await _ageDetector.estimateFromImageFile(shotPath);
      if (!mounted) return;

      _startupTimeout?.cancel();

      if (result.category == AgeCategory.unknown) {
        // The model would not commit, or the capture was not usable. Saying
        // so and offering a retry is the honest outcome; this is exactly the
        // point where the old code used to quietly guess instead.
        setState(() {
          _isAnalyzing = false;
          _candidateFrames = 0;
          _scanTimedOut = true;
          _statusText = result.description;
          _subtitleText = 'Try again';
        });
        return;
      }

      setState(() {
        _isAnalyzing = false;
        _scanResult = result;
        _statusText = result.isChild ? 'Kids Mode set' : 'Standard Mode set';
        // Deliberately not "full/all content unlocked" — this only ever sets
        // the starting default; 18+ content stays behind its own passkey
        // regardless of what this estimate says.
        _subtitleText = 'Change anytime in Settings';
      });
      _onScanComplete(result);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isAnalyzing = false;
        _candidateFrames = 0;
        _scanTimedOut = true;
        _statusText = "Couldn't read your face";
        _subtitleText = 'Try again';
      });
    } finally {
      _capturing = false;
      if (shotPath != null) {
        try {
          await File(shotPath).delete();
        } catch (_) {}
      }
    }
  }

  /// Mean luminance of the frame, 0-255.
  ///
  /// The Y plane of an NV21/YUV frame IS luminance, so this is just an
  /// average of those bytes — sampled every 64th byte, which is plenty for a
  /// "is there enough light to read a face" question and costs nothing.
  /// Without this the scanner would happily score a face in near-darkness,
  /// where the landmark positions are too imprecise for the ratios between
  /// them to mean anything.
  double? _meanLuminance(CameraImage image) {
    try {
      final bytes = image.planes.first.bytes;
      if (bytes.isEmpty) return null;
      const step = 64;
      var total = 0;
      var count = 0;
      for (var i = 0; i < bytes.length; i += step) {
        total += bytes[i];
        count++;
      }
      if (count == 0) return null;
      return total / count;
    } catch (_) {
      return null;
    }
  }

  Future<FaceScanResult?> _processCameraImage(CameraImage image) async {
    try {
      final Uint8List bytes;
      if (image.planes.length == 1) {
        bytes = image.planes.first.bytes;
      } else {
        final yPlane = image.planes[0];
        final uPlane = image.planes[1];
        final vPlane = image.planes[2];

        final int chromaWidth = (image.width / 2).ceil();
        final int pixelStride = uPlane.bytesPerPixel ??
            (uPlane.bytesPerRow >= chromaWidth * 2 ? 2 : 1);

        if (pixelStride == 2) {
          final int chromaBytes = vPlane.bytes.length;
          final totalSize = yPlane.bytes.length + chromaBytes;
          final output = Uint8List(totalSize);
          output.setRange(0, yPlane.bytes.length, yPlane.bytes);
          output.setRange(yPlane.bytes.length, totalSize, vPlane.bytes);
          bytes = output;
        } else {
          final int chromaHeight = (image.height / 2).ceil();
          final int chromaSize = chromaWidth * chromaHeight;
          final totalSize = yPlane.bytes.length + chromaSize * 2;
          final output = Uint8List(totalSize);
          output.setRange(0, yPlane.bytes.length, yPlane.bytes);
          var offset = yPlane.bytes.length;
          for (var i = 0; i < chromaSize; i++) {
            final vi = i < vPlane.bytes.length ? i : vPlane.bytes.length - 1;
            final ui = i < uPlane.bytes.length ? i : uPlane.bytes.length - 1;
            output[offset++] = vPlane.bytes[vi];
            output[offset++] = uPlane.bytes[ui];
          }
          bytes = output.sublist(0, offset);
        }
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

      return await _ageDetector.checkFrame(
        inputImage,
        frameBrightness: _meanLuminance(image),
      );
    } catch (e) {
      debugPrint('[FaceScanModal] Image processing error: $e');
      return null;
    }
  }

  Future<void> _onScanComplete(FaceScanResult result) async {
    _startupTimeout?.cancel();
    HapticFeedback.heavyImpact();
    await Future.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;

    Navigator.of(context, rootNavigator: true).pop(result);
  }

  @override
  void dispose() {
    _startupTimeout?.cancel();
    _cameraController?.dispose();
    _ageDetector.dispose();
    _pulseAnim.dispose();
    _scanLineAnim.dispose();
    _cornerAnim.dispose();
    _shimmerAnim.dispose();
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

  // ──────────────────────────────────────────────────────────
  //  UI BUILD — compact bottom-anchored scanner card
  // ──────────────────────────────────────────────────────────

  bool get _cameraReady =>
      !_hasPermissionError &&
      !_isInitializing &&
      _cameraController != null &&
      _cameraController!.value.isInitialized;

  Color get _accentColor {
    if (_scanResult != null) {
      return _scanResult!.isChild ? AppColors.success : AppColors.brandOrange;
    }
    if (_isAnalyzing) return const Color(0xFF0EA5E9);
    if (_hasPermissionError) return Colors.redAccent;
    return AppColors.brandOrange;
  }

  IconData get _statusIcon {
    if (_scanResult != null) {
      return _scanResult!.isChild ? Icons.shield_rounded : Icons.verified_rounded;
    }
    if (_hasPermissionError) return Icons.videocam_off_rounded;
    return Icons.face_retouching_natural_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final content = Material(
      color: Colors.transparent,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _buildPremiumBackground(context),
          _buildTopBar(context),
          _buildBottomCard(context),
        ],
      ),
    );

    if (!widget.startupScan) return content;

    // The mandatory startup gate: the Android back gesture/button must not
    // be able to dismiss this any more than the barrier tap already can't
    // (barrierDismissible: false on the showGeneralDialog call handles the
    // tap-outside case; this handles the hardware/gesture back case).
    return PopScope(canPop: false, child: content);
  }

  /// A calm, theme-aware gradient with two soft accent blooms — replaces
  /// the previous full-bleed raw camera feed as the backdrop. The live
  /// preview now lives only inside the compact scanner frame in the bottom
  /// card; nothing about detection depends on where (or whether) the
  /// preview is rendered, since `startImageStream` pulls frames straight
  /// from the platform camera session regardless of what's on screen.
  Widget _buildPremiumBackground(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: context.isDark
                  ? [const Color(0xFF06070C), context.bgSurface]
                  : [context.bgSurface, context.bgCard],
            ),
          ),
        ),
        Positioned(
          top: -70,
          right: -50,
          child: _GlowBlob(
            size: 220,
            color: AppColors.brandOrange.withValues(alpha: context.isDark ? 0.10 : 0.06),
          ),
        ),
        Positioned(
          bottom: -60,
          left: -60,
          child: _GlowBlob(
            size: 260,
            color: _accentColor.withValues(alpha: context.isDark ? 0.10 : 0.06),
          ),
        ),
      ],
    );
  }

  Widget _buildTopBar(BuildContext context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: context.isDark
                      ? Colors.white.withValues(alpha: 0.07)
                      : Colors.black.withValues(alpha: 0.045),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.25)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.shield_rounded, color: AppColors.brandOrange, size: 14),
                    const SizedBox(width: 6),
                    Text(
                      'Face Verification',
                      style: TextStyle(
                        color: context.textPrimary.withValues(alpha: 0.85),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.1,
                      ),
                    ),
                  ],
                ),
              ),
              // Close button — hidden during the mandatory startup gate.
              // This is the one place "mandatory" actually means something:
              // once permission is granted, the scan itself always finishes
              // — the scan must actually succeed, and an inconclusive one
              // now offers Try Again rather than letting anyone through.
              // Closing early is the only path this button would add, and
              // it's exactly what "must use the camera to get in" rules out.
              if (!widget.startupScan)
                GestureDetector(
                  onTap: () => Navigator.of(context, rootNavigator: true).pop(),
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: context.isDark
                          ? Colors.white.withValues(alpha: 0.1)
                          : Colors.black.withValues(alpha: 0.06),
                      border: Border.all(color: context.borderMedium),
                    ),
                    child: Icon(
                      Icons.close_rounded,
                      color: context.textPrimary.withValues(alpha: 0.7),
                      size: 16,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomCard(BuildContext context) {
    final accentColor = _accentColor;

    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: SafeArea(
        top: false,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 550),
          curve: Curves.easeOutCubic,
          builder: (context, t, child) {
            return Transform.translate(
              offset: Offset(0, (1 - t) * 36),
              child: Opacity(opacity: t, child: child),
            );
          },
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(32),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 26, sigmaY: 26),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
                  decoration: BoxDecoration(
                    color: context.isDark
                        ? Colors.white.withValues(alpha: 0.07)
                        : Colors.white.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(32),
                    border: Border.all(
                      color: accentColor.withValues(alpha: 0.28),
                      width: 1.3,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: accentColor.withValues(alpha: 0.16),
                        blurRadius: 32,
                        spreadRadius: 1,
                        offset: const Offset(0, -6),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Drag-handle affordance — purely decorative, signals
                      // "this is a sheet" at a glance.
                      Container(
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(
                          color: context.borderMedium,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(height: 14),
                      // Why this is happening. People were being shown a
                      // camera with no explanation at all.
                      Text(
                        'We check age once to pick your starting content '
                        'setting. Nothing is uploaded or saved.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: context.textPrimary.withValues(alpha: 0.6),
                          fontSize: 11.5,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 14),
                      _buildScannerFrame(context, accentColor),
                      const SizedBox(height: 16),
                      _buildStatusRow(context, accentColor),
                      if (_isAnalyzing && _scanResult == null) ...[
                        const SizedBox(height: 12),
                        _buildProgressDots(accentColor),
                      ],
                      if (_scanTimedOut &&
                          _scanResult == null &&
                          !_hasPermissionError) ...[
                        const SizedBox(height: 10),
                        Text(
                          'Move into good light and keep your face in frame.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: context.textPrimary.withValues(alpha: 0.55),
                            fontSize: 12,
                            height: 1.35,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _PermissionActionButton(
                              label: 'Try Again',
                              filled: true,
                              onTap: () => _initCamera(retry: true),
                            ),
                            const SizedBox(width: 10),
                            // Never a way to reach the WIDER setting without
                            // a scan — this only ever grants the restricted
                            // one, so it is an escape hatch and not a
                            // loophole. Without it, anyone the heuristic
                            // cannot read is locked out of the app entirely.
                            _PermissionActionButton(
                              label: 'Continue in Kids Mode',
                              filled: false,
                              onTap: () =>
                                  unawaited(_finishStartupFallback()),
                            ),
                          ],
                        ),
                      ],
                      if (_hasPermissionError) _buildPermissionErrorSection(context),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// The compact scanner itself: a rounded-square frame (~176dp) holding
  /// the live preview, with a pulsing accent border, slow rotating shimmer
  /// glow behind it, photo-ID-style corner brackets, a scan-line sweep
  /// while analyzing, and a checkmark burst on success.
  Widget _buildScannerFrame(BuildContext context, Color accentColor) {
    const boxSize = 176.0;
    const frameSize = boxSize + 20;
    final idleOrAnalyzing = _scanResult == null && !_hasPermissionError && !_isInitializing;

    return SizedBox(
      width: frameSize,
      height: frameSize,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (idleOrAnalyzing)
            AnimatedBuilder(
              animation: _shimmerAnim,
              builder: (context, child) {
                return Transform.rotate(
                  angle: _shimmerAnim.value * 2 * math.pi,
                  child: Container(
                    width: frameSize,
                    height: frameSize,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: SweepGradient(
                        colors: [
                          Colors.transparent,
                          accentColor.withValues(alpha: 0.30),
                          Colors.transparent,
                          Colors.transparent,
                        ],
                        stops: const [0.0, 0.22, 0.46, 1.0],
                      ),
                    ),
                  ),
                );
              },
            ),

          // Bordered, clipped scanner box.
          AnimatedBuilder(
            animation: _pulseAnim,
            builder: (context, child) {
              return Container(
                width: boxSize,
                height: boxSize,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(
                    color: accentColor.withValues(alpha: 0.65),
                    width: 2.0,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: accentColor.withValues(alpha: 0.22 + _pulseAnim.value * 0.14),
                      blurRadius: 22,
                      spreadRadius: 1 + _pulseAnim.value * 3,
                    ),
                  ],
                ),
                child: child,
              );
            },
            child: ClipRRect(
              borderRadius: BorderRadius.circular(28),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [context.bgCard, context.bgSurface],
                      ),
                    ),
                  ),
                  if (_cameraReady) _buildCameraPreview(),
                  if (_isInitializing && !_hasPermissionError)
                    const Center(
                      child: SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(
                          color: AppColors.brandOrange,
                          strokeWidth: 2.6,
                        ),
                      ),
                    ),
                  if (_hasPermissionError)
                    Center(
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.red.withValues(alpha: 0.15),
                          border: Border.all(color: Colors.redAccent, width: 1.6),
                        ),
                        child: const Icon(
                          Icons.videocam_off_rounded,
                          color: Colors.redAccent,
                          size: 22,
                        ),
                      ),
                    ),

                  // Scan-line sweep, confined to the frame.
                  if (idleOrAnalyzing)
                    AnimatedBuilder(
                      animation: _scanLineAnim,
                      builder: (context, child) {
                        final top = 14 + (_scanLineAnim.value * (boxSize - 28));
                        return Positioned(
                          left: boxSize * 0.15,
                          top: top,
                          child: Container(
                            width: boxSize * 0.7,
                            height: 2,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.transparent,
                                  accentColor.withValues(alpha: 0.75),
                                  Colors.transparent,
                                ],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: accentColor.withValues(alpha: 0.5),
                                  blurRadius: 8,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),

                  // Success checkmark burst.
                  if (_scanResult != null)
                    Center(
                      child: TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0.0, end: 1.0),
                        duration: const Duration(milliseconds: 400),
                        curve: Curves.elasticOut,
                        builder: (context, val, child) {
                          return Transform.scale(
                            scale: val,
                            child: Container(
                              width: 56,
                              height: 56,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: accentColor.withValues(alpha: 0.9),
                                boxShadow: [
                                  BoxShadow(
                                    color: accentColor.withValues(alpha: 0.4),
                                    blurRadius: 18,
                                    spreadRadius: 3,
                                  ),
                                ],
                              ),
                              child: Icon(
                                _scanResult!.isChild ? Icons.shield_rounded : Icons.check_rounded,
                                color: Colors.white,
                                size: 28,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
          ),

          // Photo-ID style corner brackets, sitting just outside the box.
          if (!_hasPermissionError) ..._buildCornerMarkers(boxSize, frameSize, accentColor),
        ],
      ),
    );
  }

  Widget _buildCameraPreview() {
    return FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: _cameraController!.value.previewSize?.height ?? 480,
        height: _cameraController!.value.previewSize?.width ?? 640,
        child: CameraPreview(_cameraController!),
      ),
    );
  }

  List<Widget> _buildCornerMarkers(double boxSize, double frameSize, Color baseColor) {
    const markerLen = 16.0;
    const markerThickness = 2.2;
    const cornerRadius = 6.0;
    final inset = (frameSize - boxSize) / 2 - 4;

    final Color markerColor;
    if (_scanResult != null) {
      markerColor = baseColor;
    } else if (_isAnalyzing) {
      markerColor = baseColor;
    } else {
      markerColor = baseColor.withValues(alpha: 0.6);
    }

    return [
      AnimatedBuilder(
        animation: _cornerAnim,
        builder: (context, child) {
          final expand = _cornerAnim.value * 3;
          return Positioned(
            left: inset - expand,
            top: inset - expand,
            child: _CornerMarker(
              color: markerColor,
              length: markerLen,
              thickness: markerThickness,
              radius: cornerRadius,
              position: _CornerPosition.topLeft,
            ),
          );
        },
      ),
      AnimatedBuilder(
        animation: _cornerAnim,
        builder: (context, child) {
          final expand = _cornerAnim.value * 3;
          return Positioned(
            right: inset - expand,
            top: inset - expand,
            child: _CornerMarker(
              color: markerColor,
              length: markerLen,
              thickness: markerThickness,
              radius: cornerRadius,
              position: _CornerPosition.topRight,
            ),
          );
        },
      ),
      AnimatedBuilder(
        animation: _cornerAnim,
        builder: (context, child) {
          final expand = _cornerAnim.value * 3;
          return Positioned(
            left: inset - expand,
            bottom: inset - expand,
            child: _CornerMarker(
              color: markerColor,
              length: markerLen,
              thickness: markerThickness,
              radius: cornerRadius,
              position: _CornerPosition.bottomLeft,
            ),
          );
        },
      ),
      AnimatedBuilder(
        animation: _cornerAnim,
        builder: (context, child) {
          final expand = _cornerAnim.value * 3;
          return Positioned(
            right: inset - expand,
            bottom: inset - expand,
            child: _CornerMarker(
              color: markerColor,
              length: markerLen,
              thickness: markerThickness,
              radius: cornerRadius,
              position: _CornerPosition.bottomRight,
            ),
          );
        },
      ),
    ];
  }

  Widget _buildStatusRow(BuildContext context, Color accentColor) {
    return Row(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: accentColor.withValues(alpha: 0.15),
            border: Border.all(color: accentColor.withValues(alpha: 0.4)),
          ),
          child: _scanResult == null && !_hasPermissionError
              ? Padding(
                  padding: const EdgeInsets.all(9),
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: accentColor,
                  ),
                )
              : Icon(_statusIcon, color: accentColor, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: Text(
                  _noCameraHardware
                      ? 'No camera detected'
                      : _hasPermissionError
                          ? 'Camera access required'
                          : (_scanTimedOut ? 'No face detected' : _statusText),
                  key: ValueKey(_hasPermissionError
                      ? 'perm'
                      : (_scanTimedOut ? 'timeout' : _statusText)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: _scanResult != null || _isAnalyzing ? accentColor : context.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              if (!_hasPermissionError) ...[
                const SizedBox(height: 2),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: Text(
                    _subtitleText,
                    key: ValueKey(_subtitleText),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: context.textPrimary.withValues(alpha: 0.42),
                      fontSize: 10.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildProgressDots(Color accentColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(5, (i) {
        final filled = i < _candidateFrames;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: filled ? 20 : 6,
          height: 6,
          margin: const EdgeInsets.symmetric(horizontal: 2.5),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(3),
            color: filled ? accentColor : accentColor.withValues(alpha: 0.2),
          ),
        );
      }),
    );
  }

  Widget _buildPermissionErrorSection(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        children: [
          Text(
            _noCameraHardware
                ? "This device doesn't have a usable camera."
                : (widget.startupScan
                    ? 'Camera access is needed to continue.'
                    : 'Enable camera access in settings.'),
            textAlign: TextAlign.center,
            style: TextStyle(
              color: context.textPrimary.withValues(alpha: 0.55),
              fontSize: 12,
              height: 1.35,
            ),
          ),
          if (widget.startupScan) ...[
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (!_permissionDenied)
                  _PermissionActionButton(
                    label: 'Try Again',
                    filled: true,
                    onTap: () => _initCamera(retry: true),
                  )
                else ...[
                  _PermissionActionButton(
                    label: 'Try Again',
                    filled: false,
                    onTap: () => _initCamera(retry: true),
                  ),
                  const SizedBox(width: 10),
                  _PermissionActionButton(
                    label: 'Open Settings',
                    filled: true,
                    onTap: openAppSettings,
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────
//  DECORATIVE BACKGROUND GLOW
// ──────────────────────────────────────────────────────────

class _GlowBlob extends StatelessWidget {
  final double size;
  final Color color;

  const _GlowBlob({required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size / 2),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 40, sigmaY: 40),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(shape: BoxShape.circle, color: color),
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────
//  PERMISSION ACTION BUTTON
// ──────────────────────────────────────────────────────────

class _PermissionActionButton extends StatelessWidget {
  final String label;
  final bool filled;
  final VoidCallback onTap;

  const _PermissionActionButton({
    required this.label,
    required this.filled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          color: filled
              ? AppColors.brandOrange
              : (context.isDark
                  ? Colors.white.withValues(alpha: 0.08)
                  : Colors.black.withValues(alpha: 0.05)),
          border: filled ? null : Border.all(color: context.borderMedium),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: filled ? Colors.black : context.textPrimary.withValues(alpha: 0.85),
          ),
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────
//  CORNER MARKER (photo-ID scanner style)
// ──────────────────────────────────────────────────────────

enum _CornerPosition { topLeft, topRight, bottomLeft, bottomRight }

class _CornerMarker extends StatelessWidget {
  final Color color;
  final double length;
  final double thickness;
  final double radius;
  final _CornerPosition position;

  const _CornerMarker({
    required this.color,
    required this.length,
    required this.thickness,
    required this.radius,
    required this.position,
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(length + thickness, length + thickness),
      painter: _CornerPainter(
        color: color,
        thickness: thickness,
        radius: radius,
        position: position,
      ),
    );
  }
}

class _CornerPainter extends CustomPainter {
  final Color color;
  final double thickness;
  final double radius;
  final _CornerPosition position;

  _CornerPainter({
    required this.color,
    required this.thickness,
    required this.radius,
    required this.position,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = thickness
      ..strokeCap = StrokeCap.round;

    final w = size.width;
    final h = size.height;

    final path = Path();
    switch (position) {
      case _CornerPosition.topLeft:
        path.moveTo(0, h * 0.65);
        path.lineTo(0, radius);
        path.quadraticBezierTo(0, 0, radius, 0);
        path.lineTo(w * 0.65, 0);
        break;
      case _CornerPosition.topRight:
        path.moveTo(w * 0.35, 0);
        path.lineTo(w - radius, 0);
        path.quadraticBezierTo(w, 0, w, radius);
        path.lineTo(w, h * 0.65);
        break;
      case _CornerPosition.bottomLeft:
        path.moveTo(0, h * 0.35);
        path.lineTo(0, h - radius);
        path.quadraticBezierTo(0, h, radius, h);
        path.lineTo(w * 0.65, h);
        break;
      case _CornerPosition.bottomRight:
        path.moveTo(w * 0.35, h);
        path.lineTo(w - radius, h);
        path.quadraticBezierTo(w, h, w, h - radius);
        path.lineTo(w, h * 0.35);
        break;
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_CornerPainter oldDelegate) =>
      color != oldDelegate.color ||
      thickness != oldDelegate.thickness ||
      position != oldDelegate.position;
}
