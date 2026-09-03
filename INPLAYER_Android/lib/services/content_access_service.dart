import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:dio/dio.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';

/// The three real modes the website's content-access system supports (see
/// app/lib/contentAccess.ts's AudienceMode). "all" and "kids" both require a
/// verified 6-digit passkey to switch INTO — "family" (18+ hidden) is always
/// free to drop back to, on the website and here.
enum AudienceMode { all, family, kids }

AudienceMode audienceModeFromString(String? raw) {
  switch (raw) {
    case 'all':
      return AudienceMode.all;
    case 'kids':
      return AudienceMode.kids;
    default:
      return AudienceMode.family;
  }
}

String audienceModeToString(AudienceMode mode) {
  switch (mode) {
    case AudienceMode.all:
      return 'all';
    case AudienceMode.kids:
      return 'kids';
    case AudienceMode.family:
      return 'family';
  }
}

String audienceModeLabel(AudienceMode mode) {
  switch (mode) {
    case AudienceMode.all:
      return 'All content, including 18+';
    case AudienceMode.kids:
      return 'Kids content only';
    case AudienceMode.family:
      return 'Everything except 18+';
  }
}

class ContentAccessState {
  final AudienceMode mode;
  final bool hasPasskey;

  const ContentAccessState({required this.mode, required this.hasPasskey});
}

/// Every write here only ever ASKS the server to change something — never
/// changes anything locally on its own — mirroring
/// app/components/settings/sections/ContentAccessSection.tsx's own comment
/// about why: a parental control a page script (or a curious kid poking at
/// the app) can flip by itself isn't a control. The only thing this class
/// caches locally is the mode value it was just told by a successful
/// server response, purely so dio_client.dart's request interceptor has
/// something to send back as the `inplayer-audience` cookie on the next
/// call — that cache is never treated as authoritative on its own.
final contentAccessServiceProvider = Provider<ContentAccessService>((ref) {
  return ContentAccessService();
});

/// Bumped after the server accepts a mode change. Feed surfaces listen to
/// this so their pre-change HTTP cache is never shown after a content switch.
final contentAccessRevisionProvider = StateProvider<int>((ref) => 0);

class ContentAccessResult {
  final bool success;
  final String? error;
  final bool needsPasskey;

  const ContentAccessResult({
    required this.success,
    this.error,
    this.needsPasskey = false,
  });
}

class ContentAccessService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<void> _cacheMode(AudienceMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('audience', audienceModeToString(mode));
  }

  /// Sets audience mode locally without prompting for passcodes.
  Future<void> setModeLocally(AudienceMode mode) async {
    await _cacheMode(mode);
  }

  /// GET /api/content-access -> {mode, hasPasskey}. Works signed-out too —
  /// a visitor who's never touched this still has a mode (the safe
  /// default), which is why this doesn't require auth.
  Future<ContentAccessState?> getState() async {
    try {
      final response = await _dio.get(ApiConstants.contentAccess);
      if (response.statusCode != 200 || response.data is! Map) return null;

      final data = response.data as Map;
      final mode = audienceModeFromString(data['mode'] as String?);
      // Keep the local cache in sync with the server's answer, not just
      // with our own successful writes — e.g. after signing in on a device
      // that already had a mode set on a different one.
      await _cacheMode(mode);
      return ContentAccessState(
        mode: mode,
        hasPasskey: data['hasPasskey'] == true,
      );
    } catch (e) {
      _logger.e('Error fetching content access state: $e');
      return null;
    }
  }

  /// Unlock a mode. Requires an existing passkey — the server returns
  /// needsPasskey: true (409) if the account has never created one yet, in
  /// which case the UI should fall through to setPasskey() first.
  Future<ContentAccessResult> setMode(
    AudienceMode mode, {
    String? passkey,
  }) async {
    final cleanedPasskey = passkey?.trim();
    try {
      final response = await _dio.post(
        ApiConstants.contentAccess,
        data: {
          'action': 'set_mode',
          'mode': audienceModeToString(mode),
          if (cleanedPasskey != null && cleanedPasskey.isNotEmpty)
            'passkey': cleanedPasskey,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        final serverMode = data is Map
            ? audienceModeFromString(data['mode']?.toString())
            : mode;
        await _cacheMode(serverMode);
        return const ContentAccessResult(success: true);
      }

      final data = response.data;
      final error = data is Map
          ? (data['error']?.toString() ?? data['message']?.toString())
          : null;
      final needsPasskey = data is Map && data['needsPasskey'] == true;
      return ContentAccessResult(
        success: false,
        error: error ?? "Couldn't update content settings.",
        needsPasskey: needsPasskey,
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      final error = data is Map
          ? (data['error']?.toString() ?? data['message']?.toString())
          : null;
      return ContentAccessResult(
        success: false,
        error: error ?? 'Something went wrong.',
        needsPasskey: data is Map && data['needsPasskey'] == true,
      );
    } catch (e) {
      _logger.e('Error setting content access mode: $e');
      return const ContentAccessResult(
        success: false,
        error: 'Something went wrong.',
      );
    }
  }

  /// Create a brand-new passkey (currentPasskey omitted) or change an
  /// existing one (currentPasskey required — proves whoever's doing this
  /// already knows the old code, otherwise anyone signed in on the device
  /// could silently overwrite a parent's code).
  Future<ContentAccessResult> setPasskey(
    String passkey, {
    String? currentPasskey,
  }) async {
    final trimmedPasskey = passkey.trim();
    final trimmedCurrent = currentPasskey?.trim();

    if (trimmedPasskey.length != 6 ||
        (!RegExp(r'^\d{6}$').hasMatch(trimmedPasskey))) {
      return const ContentAccessResult(
        success: false,
        error: 'Use a 6-digit numeric passkey.',
      );
    }

    if (trimmedCurrent != null &&
        (trimmedCurrent.length != 6 ||
            !RegExp(r'^\d{6}$').hasMatch(trimmedCurrent))) {
      return const ContentAccessResult(
        success: false,
        error: 'Enter your current 6-digit passkey.',
      );
    }

    try {
      final response = await _dio.post(
        ApiConstants.contentAccess,
        data: {
          'action': 'set_passkey',
          'passkey': trimmedPasskey,
          if (trimmedCurrent != null && trimmedCurrent.isNotEmpty)
            'currentPasskey': trimmedCurrent,
        },
      );

      if (response.statusCode == 200) {
        return const ContentAccessResult(success: true);
      }

      final data = response.data;
      final error = data is Map
          ? (data['error']?.toString() ?? data['message']?.toString())
          : null;
      return ContentAccessResult(
        success: false,
        error: error ?? "Couldn't save that passkey.",
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      final error = data is Map
          ? (data['error']?.toString() ?? data['message']?.toString())
          : null;
      return ContentAccessResult(
        success: false,
        error: error ?? "Couldn't save that passkey.",
      );
    } catch (e) {
      _logger.e('Error setting passkey: $e');
      return const ContentAccessResult(
        success: false,
        error: 'Something went wrong.',
      );
    }
  }

  /// Drop back to the safe default. No passkey needed — like the website,
  /// this only ever makes things MORE restrictive, and it's the escape
  /// hatch for someone who's forgotten their code.
  Future<bool> resetMode() async {
    try {
      final response = await _dio.post(
        ApiConstants.contentAccess,
        data: {'action': 'reset_mode'},
      );
      if (response.statusCode == 200) {
        await _cacheMode(AudienceMode.family);
        return true;
      }
      return false;
    } catch (e) {
      _logger.e('Error resetting content access mode: $e');
      return false;
    }
  }
}
