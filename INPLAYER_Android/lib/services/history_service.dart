import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';

final historyServiceProvider = Provider<HistoryService>((ref) {
  return HistoryService();
});

/// Wraps GET/POST /api/history (app/api/history/route.ts). Rows are
/// denormalized: {userId, videoId, title, thumbnailUrl, category,
/// contentType, watchedAt} — enough to render Watch History without a
/// second lookup per item.
class HistoryService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<List<Map<String, dynamic>>> getHistory() async {
    try {
      final response = await _dio.get(ApiConstants.watchHistory);

      if (response.statusCode != 200 || response.data is! Map) {
        return [];
      }

      final json = (response.data as Map)['history'];
      if (json is! List) return [];

      return json.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    } catch (e) {
      _logger.e('Error fetching watch history: $e');
      return [];
    }
  }

  /// Records a watch — called once when a video starts playing on the
  /// watch page, mirroring the website's own behavior.
  Future<bool> recordWatch(String videoId) async {
    try {
      final response =
          await _dio.post(ApiConstants.watchHistory, data: {'videoId': videoId});
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error recording watch history for $videoId: $e');
      return false;
    }
  }
}
