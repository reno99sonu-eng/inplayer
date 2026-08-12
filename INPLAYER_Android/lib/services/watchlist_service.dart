import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';

final watchlistServiceProvider = Provider<WatchlistService>((ref) {
  return WatchlistService();
});

/// Wraps GET/POST /api/watchlist (app/api/watchlist/route.ts) — the "Save"
/// / Watch Later button on a video, and the Watchlist profile screen.
class WatchlistService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<bool> isSaved(String videoId) async {
    try {
      final response = await _dio.get(
        ApiConstants.watchlist,
        queryParameters: {'videoId': videoId},
      );

      if (response.statusCode == 200 && response.data is Map) {
        return (response.data as Map)['inWatchlist'] == true;
      }
    } catch (e) {
      _logger.e('Error checking watchlist status for $videoId: $e');
    }
    return false;
  }

  /// The signed-in user's full watchlist (no videoId query param).
  /// Each item is denormalized: {userId, videoId, title, thumbnailUrl,
  /// category, addedAt} — enough to render a list without a second
  /// per-item video lookup.
  Future<List<Map<String, dynamic>>> getWatchlist() async {
    try {
      final response = await _dio.get(ApiConstants.watchlist);

      if (response.statusCode == 200 && response.data is Map) {
        final items = (response.data as Map)['items'];
        if (items is List) {
          return items.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
        }
      }
    } catch (e) {
      _logger.e('Error fetching watchlist: $e');
    }
    return [];
  }

  Future<bool> add(String videoId) async {
    try {
      final response = await _dio.post(
        ApiConstants.watchlist,
        data: {'videoId': videoId, 'action': 'add'},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error adding $videoId to watchlist: $e');
      return false;
    }
  }

  Future<bool> remove(String videoId) async {
    try {
      final response = await _dio.post(
        ApiConstants.watchlist,
        data: {'videoId': videoId, 'action': 'remove'},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error removing $videoId from watchlist: $e');
      return false;
    }
  }
}
