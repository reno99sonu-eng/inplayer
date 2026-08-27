import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_logo.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../services/biometric_lock_service.dart';

class BiometricLockScreen extends ConsumerStatefulWidget {
  const BiometricLockScreen({super.key});

  @override
  ConsumerState<BiometricLockScreen> createState() => _BiometricLockScreenState();
}

class _BiometricLockScreenState extends ConsumerState<BiometricLockScreen> {
  bool _isAuthenticating = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _promptAuth();
    });
  }

  Future<void> _promptAuth() async {
    if (_isAuthenticating) return;
    setState(() => _isAuthenticating = true);

    final success = await ref.read(biometricLockProvider.notifier).authenticate();

    if (!mounted) return;
    setState(() => _isAuthenticating = false);

    if (!success) {
      // Stay locked and allow tap to retry
    }
  }

  @override
  Widget build(BuildContext context) {
    final lockState = ref.watch(biometricLockProvider);
    if (!lockState.isEnabled || !lockState.isLocked) {
      return const SizedBox.shrink();
    }

    final isDark = context.isDark;

    return Material(
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

                // Biometric Hologram Badge
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.brandOrange.withValues(alpha: 0.12),
                    border: Border.all(
                      color: AppColors.brandOrange.withValues(alpha: 0.4),
                      width: 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.brandOrange.withValues(alpha: 0.25),
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
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),

                Text(
                  'Use your Passkey, Fingerprint or Device PIN to unlock',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: context.textSecondary,
                    height: 1.4,
                  ),
                ),
                const Spacer(),

                // Unlock Action Button
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.brandOrange,
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 8,
                    shadowColor: AppColors.brandOrange.withValues(alpha: 0.5),
                  ),
                  onPressed: _isAuthenticating ? null : _promptAuth,
                  icon: _isAuthenticating
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.lock_open_rounded, color: Colors.white, size: 20),
                  label: Text(
                    _isAuthenticating ? 'Verifying...' : 'Unlock with Passkey',
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
    );
  }
}
