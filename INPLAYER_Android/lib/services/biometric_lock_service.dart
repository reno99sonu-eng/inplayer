import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

class BiometricLockState {
  final bool isEnabled;
  final bool isLocked;
  final bool canCheckBiometrics;
  final List<BiometricType> availableBiometrics;

  const BiometricLockState({
    this.isEnabled = false,
    this.isLocked = false,
    this.canCheckBiometrics = false,
    this.availableBiometrics = const [],
  });

  BiometricLockState copyWith({
    bool? isEnabled,
    bool? isLocked,
    bool? canCheckBiometrics,
    List<BiometricType>? availableBiometrics,
  }) {
    return BiometricLockState(
      isEnabled: isEnabled ?? this.isEnabled,
      isLocked: isLocked ?? this.isLocked,
      canCheckBiometrics: canCheckBiometrics ?? this.canCheckBiometrics,
      availableBiometrics: availableBiometrics ?? this.availableBiometrics,
    );
  }
}

class BiometricLockNotifier extends StateNotifier<BiometricLockState> {
  static const _prefKey = 'inplayer:biometric_lock_enabled';
  final LocalAuthentication _auth = LocalAuthentication();

  BiometricLockNotifier() : super(const BiometricLockState()) {
    _init();
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool(_prefKey) ?? false;

    bool canCheck = false;
    List<BiometricType> available = [];
    try {
      canCheck = await _auth.canCheckBiometrics || await _auth.isDeviceSupported();
      if (canCheck) {
        available = await _auth.getAvailableBiometrics();
      }
    } catch (_) {}

    state = state.copyWith(
      isEnabled: enabled,
      isLocked: enabled, // Lock initially on app cold start if enabled
      canCheckBiometrics: canCheck,
      availableBiometrics: available,
    );
  }

  /// Toggles the Biometric/Passkey lock on or off.
  Future<bool> setEnabled(bool enabled) async {
    if (enabled) {
      // Require an immediate successful authentication before enabling
      final authenticated = await authenticate(
        reason: 'Scan your Fingerprint or Face to enable Passkey Lock',
      );
      if (!authenticated) return false;
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKey, enabled);
    state = state.copyWith(
      isEnabled: enabled,
      isLocked: false,
    );
    return true;
  }

  /// Prompts native Passkey / Fingerprint / Device PIN dialog.
  Future<bool> authenticate({String? reason}) async {
    try {
      final authenticated = await _auth.authenticate(
        localizedReason: reason ?? 'Unlock INPLAYER to continue',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false, // allows fallback to device Passcode/PIN
          useErrorDialogs: true,
        ),
      );

      if (authenticated) {
        HapticFeedback.mediumImpact();
        state = state.copyWith(isLocked: false);
      }
      return authenticated;
    } catch (e) {
      debugPrint('[BiometricLock] Auth error: ');
      return false;
    }
  }

  void lock() {
    if (state.isEnabled && !state.isLocked) {
      state = state.copyWith(isLocked: true);
    }
  }

  void unlockDirect() {
    state = state.copyWith(isLocked: false);
  }
}

final biometricLockProvider = StateNotifierProvider<BiometricLockNotifier, BiometricLockState>((ref) {
  return BiometricLockNotifier();
});
