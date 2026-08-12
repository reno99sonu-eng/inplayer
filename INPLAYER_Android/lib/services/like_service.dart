import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';

final likeServiceProvider = Provider<LikeService>((ref) {
  return LikeService();
});

/// Wraps GET/POST /api/likes (app/api/likes/route.ts). One creatorId-style
/// reaction per user per video — "like", "dislike", or none — not a
/// separate like/dislike toggle pair.
class LikeService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// { likeCount, dislikeCount, myReaction: 'like' | 'dislike' | null }
  Future<Map<String, dynamic>> getStatus(String videoId) async {
    try {
      final response = await _dio.get(
        ApiConstants.likes,
        queryParameters: {'videoId': videoId},
      );

      if (response.statusCode == 200 && response.data is Map) {
        return Map<String, dynamic>.from(response.data as Map);
      }
    } catch (e) {
      _logger.e('Error fetching like status: $e');
    }
    return {'likeCount': 0, 'dislikeCount': 0, 'myReaction': null};
  }

  /// action must be 'like' | 'dislike' | 'remove'.
  Future<bool> react(String videoId, String action) async {
    try {
      final response = await _dio.post(
        ApiConstants.likes,
        data: {'videoId': videoId, 'action': action},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error reacting to video $videoId: $e');
      return false;
    }
  }
}
