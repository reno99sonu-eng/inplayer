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
