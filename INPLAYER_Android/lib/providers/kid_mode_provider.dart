import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class KidModeState {
  final bool isEnabled;
  final bool hasPin;
  final String? activeFilterTag;
  final DateTime? lastScanTime;

  const KidModeState({
    this.isEnabled = false,
    this.hasPin = false,
    this.activeFilterTag,
    this.lastScanTime,
  });

  KidModeState copyWith({
    bool? isEnabled,
    bool? hasPin,
    String? activeFilterTag,
    DateTime? lastScanTime,
  }) {
    return KidModeState(
      isEnabled: isEnabled ?? this.isEnabled,
      hasPin: hasPin ?? this.hasPin,
      activeFilterTag: activeFilterTag ?? this.activeFilterTag,
      lastScanTime: lastScanTime ?? this.lastScanTime,
    );
  }
}

class KidModeNotifier extends StateNotifier<KidModeState> {
  static const _prefKidModeKey = 'inplayer:kids_mode_enabled';
  static const _prefPinKey = 'inplayer:kids_mode_pin';

  KidModeNotifier() : super(const KidModeState()) {
    _loadFromPrefs();
  }

  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool(_prefKidModeKey) ?? false;
    final pin = prefs.getString(_prefPinKey);
    state = state.copyWith(
      isEnabled: enabled,
      hasPin: pin != null && pin.isNotEmpty,
    );
  }

  /// Enables or disables Kid Mode.
  Future<void> setKidMode(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKidModeKey, enabled);
    state = state.copyWith(
      isEnabled: enabled,
      lastScanTime: DateTime.now(),
    );
  }

  /// Sets or updates the 4-digit parental PIN.
  Future<bool> setParentalPin(String pin) async {
    if (pin.length != 4) return false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefPinKey, pin);
    state = state.copyWith(hasPin: true);
    return true;
  }

  /// Verifies if the entered PIN matches the saved parental PIN.
  Future<bool> verifyPin(String enteredPin) async {
    final prefs = await SharedPreferences.getInstance();
    final savedPin = prefs.getString(_prefPinKey);
    // If no pin is set yet, default to '0000' or accept matching
    if (savedPin == null || savedPin.isEmpty) {
      return enteredPin == '0000';
    }
    return savedPin == enteredPin;
  }
}

final kidModeProvider = StateNotifierProvider<KidModeNotifier, KidModeState>((ref) {
  return KidModeNotifier();
});
