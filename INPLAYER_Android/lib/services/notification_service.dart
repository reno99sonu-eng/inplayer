import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/notification_item.dart';

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService();
});

/// Wraps GET/PATCH /api/notifications (app/api/notifications/route.ts).
class NotificationService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<List<NotificationItem>> getNotifications() async {
    try {
      final response = await _dio.get(ApiConstants.notifications);

      if (response.statusCode != 200 || response.data is! Map) {
        return [];
      }

      final json = (response.data as Map)['notifications'];
      if (json is! List) return [];

      return json
          .whereType<Map>()
          .map((e) => NotificationItem.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      _logger.e('Error fetching notifications: $e');
      return [];
    }
  }

  /// Marks every one of the signed-in user's notifications as read — the
  /// backend does this in bulk, there's no per-notification endpoint.
  Future<bool> markAllRead() async {
    try {
      final response = await _dio.patch(ApiConstants.notifications);
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error marking notifications read: $e');
      return false;
    }
  }
}
