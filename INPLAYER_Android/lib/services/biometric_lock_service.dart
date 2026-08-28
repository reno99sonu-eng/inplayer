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

class BiometricLockNotifier extends StateNotifier<BiometricLockState> with WidgetsBindingObserver {
  static const _prefKey = 'inplayer:biometric_lock_enabled';
  final LocalAuthentication _auth = LocalAuthentication();
  DateTime? _backgroundedTime;
  bool _isAuthenticating = false;

  BiometricLockNotifier() : super(const BiometricLockState()) {
    WidgetsBinding.instance.addObserver(this);
    _init();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!this.state.isEnabled) return;

    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      _backgroundedTime = DateTime.now();
    } else if (state == AppLifecycleState.resumed) {
      if (_isAuthenticating) return;
      if (_backgroundedTime != null) {
        final elapsed = DateTime.now().difference(_backgroundedTime!).inSeconds;
        if (elapsed >= 1) {
          lock();
        }
      }
      _backgroundedTime = null;
    }
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
        reason: 'Scan your Fingerprint, Face, or enter Device PIN to enable App Lock',
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
    if (_isAuthenticating) return false;
    _isAuthenticating = true;
    try {
      final authenticated = await _auth.authenticate(
        localizedReason: reason ?? 'Unlock INPLAYER to continue',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false, // allows fallback to device Passcode/PIN
          useErrorDialogs: true,
          sensitiveTransaction: true,
        ),
      );

      _isAuthenticating = false;
      if (authenticated) {
        HapticFeedback.mediumImpact();
        state = state.copyWith(isLocked: false);
      }
      return authenticated;
    } catch (e) {
      _isAuthenticating = false;
      debugPrint('[BiometricLock] Auth error: $e');
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
