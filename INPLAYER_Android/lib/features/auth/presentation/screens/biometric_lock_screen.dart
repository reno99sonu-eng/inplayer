import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_logo.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../services/biometric_lock_service.dart';

/// Full-screen overlay for the optional device-auth app lock.
///
/// It waits until the stored lock state has actually loaded before asking
/// Android for biometric/PIN verification. The old eager prompt ran on every
/// launch—even when App Lock was disabled—and could overlap other startup
/// overlays.
class BiometricLockScreen extends ConsumerStatefulWidget {
  const BiometricLockScreen({super.key});

  @override
  ConsumerState<BiometricLockScreen> createState() =>
      _BiometricLockScreenState();
}

class _BiometricLockScreenState extends ConsumerState<BiometricLockScreen> {
  bool _isAuthenticating = false;
  bool _promptQueued = false;

  void _queuePromptIfNeeded(BiometricLockState state) {
    if (_promptQueued ||
        _isAuthenticating ||
        !state.isEnabled ||
        !state.isLocked) {
      return;
    }

    _promptQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      _promptQueued = false;
      if (!mounted) return;
      await _promptAuth();
    });
  }

  Future<void> _promptAuth() async {
    if (_isAuthenticating) return;
    final lockState = ref.read(biometricLockProvider);
    if (!lockState.isEnabled || !lockState.isLocked) return;

    setState(() => _isAuthenticating = true);
    try {
      await ref.read(biometricLockProvider.notifier).authenticate();
    } finally {
      if (mounted) setState(() => _isAuthenticating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lockState = ref.watch(biometricLockProvider);
    if (!lockState.isEnabled || !lockState.isLocked) {
      return const IgnorePointer(ignoring: true, child: SizedBox.expand());
    }

    _queuePromptIfNeeded(lockState);
    final isDark = context.isDark;

    // The MaterialApp builder's root Stack already uses StackFit.expand, so
    // this stays a normal child instead of changing parent-data widgets while
    // semantic updates are in flight.
    return SizedBox.expand(
      child: Material(
        color: isDark ? const Color(0xFF030712) : const Color(0xFFFAF5E8),
        child: PatternBackground(
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Spacer(),
                  const AppLogo(height: 38),
                  const SizedBox(height: 32),
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.brandOrange.withValues(alpha: .12),
                      border: Border.all(
                        color: AppColors.brandOrange.withValues(alpha: .4),
                        width: 2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.brandOrange.withValues(alpha: .25),
                          blurRadius: 30,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.fingerprint_rounded,
                      color: AppColors.brandOrange,
                      size: 48,
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    'INPLAYER Locked',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: context.textPrimary,
                      letterSpacing: -.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Use your fingerprint, face, or device PIN to unlock.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: context.textSecondary,
                      height: 1.4,
                    ),
                  ),
                  const Spacer(),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.brandOrange,
                      minimumSize: const Size.fromHeight(50),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 8,
                      shadowColor: AppColors.brandOrange.withValues(alpha: .5),
                    ),
                    onPressed: _isAuthenticating ? null : _promptAuth,
                    icon: _isAuthenticating
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(
                            Icons.lock_open_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                    label: Text(
                      _isAuthenticating
                          ? 'Verifying…'
                          : 'Unlock with device security',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
