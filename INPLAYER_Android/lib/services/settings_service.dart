import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';

final settingsServiceProvider = Provider<SettingsService>((ref) {
  return SettingsService();
});

/// Wraps the action-based POST /api/profile/settings (each action updates
/// one field independently) and DELETE /api/account/delete
/// (app/api/profile/settings/route.ts, app/api/account/delete/route.ts).
class SettingsService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<bool> updateName(String name) =>
      _post({'action': 'update_name', 'name': name});

  Future<bool> updateBio(String bio) =>
      _post({'action': 'update_bio', 'description': bio});

  /// Atomically claims a public handle through the same uniqueness lock used
  /// by the web profile editor.  A successful response contains the backend's
  /// final-cased handle, which callers should put into local auth state.
  Future<SettingsActionResult> updateUsername(String username) async {
    try {
      final response = await _dio.post(
        ApiConstants.username,
        data: {'username': username},
      );
      final data = response.data is Map ? response.data as Map : const {};
      if (response.statusCode == 200 && data['success'] == true) {
        return SettingsActionResult(
          success: true,
          username: data['username']?.toString(),
        );
      }
      return SettingsActionResult(
        success: false,
        error: data['error']?.toString() ?? 'Could not update your username.',
      );
    } catch (e) {
      _logger.e('Error updating username: $e');
      return const SettingsActionResult(
        success: false,
        error: 'Could not update your username. Please try again.',
      );
    }
  }

  /// Persists the exact `{ social, other }` structure accepted by
  /// /api/profile/settings.  These links are displayed on the public channel
  /// page, so they must never be kept only in local widget state.
  Future<SettingsActionResult> updateSocialLinks({
    required Map<String, String> social,
    required List<Map<String, String>> other,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.profileSettings,
        data: {
          'action': 'update_social_links',
          'social': social,
          'other': other,
        },
      );
      final data = response.data is Map ? response.data as Map : const {};
      return SettingsActionResult(
        success: response.statusCode == 200 && data['success'] == true,
        error: data['error']?.toString(),
      );
    } catch (e) {
      _logger.e('Error updating social links: $e');
      return const SettingsActionResult(
        success: false,
        error: 'Could not save your links. Please try again.',
      );
    }
  }

  /// value must be 'public' | 'private' | 'connections'.
  Future<bool> updatePrivacy(String value) =>
      _post({'action': 'update_privacy', 'usernamePrivacy': value});

  /// Save or remove user avatar (base64 data URL).
  Future<bool> updateAvatar(String? avatarUrl) async {
    try {
      final response = await _dio.post(
        ApiConstants.profileAvatar,
        data: {'avatarUrl': avatarUrl},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error updating avatar: $e');
      return false;
    }
  }

  /// Save or remove the channel cover photo (data URL or null to remove).
  Future<bool> updateCoverPhoto(String? coverPhotoUrl) async {
    try {
      final response = await _dio.post(
        ApiConstants.profileCover,
        data: {'coverPhotoUrl': coverPhotoUrl},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error updating cover photo: $e');
      return false;
    }
  }

  /// Submit a bug / error report to /api/bug-reports
  Future<bool> submitBugReport({
    required String description,
    String? screenshotDataUrl,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.bugReports,
        data: {
          'description': description,
          'pageUrl': 'INPLAYER_Android_App',
          'userAgent': 'InPlayer-Android-Native',
          if (screenshotDataUrl != null) 'screenshotDataUrl': screenshotDataUrl,
        },
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error submitting bug report: $e');
      return false;
    }
  }

  /// Fetch active user sessions from /api/sessions
  Future<List<Map<String, dynamic>>> getSessions() async {
    try {
      final response = await _dio.get(ApiConstants.sessions);
      if (response.statusCode == 200 && response.data is Map) {
        final list = response.data['sessions'];
        if (list is List) {
          return list.whereType<Map<String, dynamic>>().toList();
        }
      }
      return [];
    } catch (e) {
      _logger.e('Error fetching sessions: $e');
      return [];
    }
  }

  /// Revoke a single active session
  Future<bool> revokeSession(String sessionId) async {
    try {
      final response = await _dio.delete('${ApiConstants.sessions}/$sessionId');
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error revoking session: $e');
      return false;
    }
  }

  /// Logout everywhere
  Future<bool> logoutAllSessions() async {
    try {
      final response = await _dio.post('${ApiConstants.sessions}/logout-all');
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error logging out all sessions: $e');
      return false;
    }
  }

  Future<bool> _post(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post(
        ApiConstants.profileSettings,
        data: data,
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error posting profile setting ${data['action']}: $e');
      return false;
    }
  }

  /// Cleans up everything server-side owned by this account (uploaded
  /// videos, username reservation, profile row). Must be called BEFORE
  /// AuthService.deleteUser() — see that method's doc comment for why the
  /// order matters. Returns any partial-failure warnings the backend
  /// reports (it still returns success:true and does its best-effort even
  /// if some cleanup steps fail).
  Future<AccountDeleteResult> deleteAccountData() async {
    try {
      final response = await _dio.delete(ApiConstants.accountDelete);
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final warnings =
            (data['errors'] as List?)?.whereType<String>().toList() ?? [];
        return AccountDeleteResult(success: true, warnings: warnings);
      }
      return AccountDeleteResult(success: false);
    } catch (e) {
      _logger.e('Error deleting account data: $e');
      return AccountDeleteResult(success: false);
    }
  }
}

class AccountDeleteResult {
  final bool success;
  final List<String> warnings;

  AccountDeleteResult({required this.success, this.warnings = const []});
}

class SettingsActionResult {
  final bool success;
  final String? error;
  final String? username;

  const SettingsActionResult({
    required this.success,
    this.error,
    this.username,
  });
}
