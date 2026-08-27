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

  Future<bool> updateName(String name) => _post({'action': 'update_name', 'name': name});

  Future<bool> updateBio(String bio) =>
      _post({'action': 'update_bio', 'description': bio});

  /// value must be 'public' | 'private' | 'connections'.
  Future<bool> updatePrivacy(String value) =>
      _post({'action': 'update_privacy', 'usernamePrivacy': value});

  /// Save or remove user avatar (base64 data URL).
  Future<bool> updateAvatar(String? avatarUrl) async {
    try {
      final response = await _dio.post(ApiConstants.profileAvatar, data: {
        'avatarUrl': avatarUrl,
      });
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error updating avatar: $e');
      return false;
    }
  }

  /// Save or remove the channel cover photo (data URL or null to remove).
  Future<bool> updateCoverPhoto(String? coverPhotoUrl) async {
    try {
      final response = await _dio.post(ApiConstants.profileCover, data: {
        'coverPhotoUrl': coverPhotoUrl,
      });
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
      final response = await _dio.post(ApiConstants.bugReports, data: {
        'description': description,
        'pageUrl': 'INPLAYER_Android_App',
        'userAgent': 'InPlayer-Android-Native',
        if (screenshotDataUrl != null) 'screenshotDataUrl': screenshotDataUrl,
      });
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
      final response = await _dio.post(ApiConstants.profileSettings, data: data);
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
        final warnings = (data['errors'] as List?)?.whereType<String>().toList() ?? [];
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
