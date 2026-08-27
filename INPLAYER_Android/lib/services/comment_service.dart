import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/comment.dart';

final commentServiceProvider = Provider<CommentService>((ref) {
  return CommentService();
});

/// Wraps GET/POST/DELETE /api/comments (app/api/comments/route.ts).
class CommentService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<List<Comment>> getComments(String videoId) async {
    try {
      final response = await _dio.get(
        ApiConstants.comments,
        queryParameters: {'videoId': videoId},
      );

      if (response.statusCode != 200 || response.data is! Map) {
        return [];
      }

      final commentsJson = (response.data as Map)['comments'];
      if (commentsJson is! List) return [];

      return commentsJson
          .whereType<Map>()
          .map((json) => Comment.fromJson(Map<String, dynamic>.from(json)))
          .toList();
    } catch (e) {
      _logger.e('Error fetching comments for $videoId: $e');
      return [];
    }
  }

  /// Returns the newly-created comment, or null if it was posted but
  /// auto-flagged (backend hides flagged comments from everyone, including
  /// the poster, until an admin clears them — still returns 200 with
  /// {comment, flagged: true} so we can tell the user it's pending review).
  Future<CommentPostResult> postComment(
    String videoId,
    String text, {
    String? parentUserId,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.comments,
        data: {
          'videoId': videoId,
          'text': text,
          'parentUserId': ?parentUserId,
        },
      );

      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final commentJson = data['comment'];
        final comment = commentJson is Map
            ? Comment.fromJson(Map<String, dynamic>.from(commentJson))
            : null;
        return CommentPostResult(
          comment: comment,
          flagged: data['flagged'] == true,
        );
      }

      if (response.statusCode == 401) {
        return CommentPostResult(requiresSignIn: true);
      }

      return CommentPostResult(error: 'Could not post your comment.');
    } catch (e) {
      _logger.e('Error posting comment on $videoId: $e');
      return CommentPostResult(error: 'Could not post your comment.');
    }
  }

  Future<bool> deleteComment(String videoId, String commentId) async {
    try {
      final response = await _dio.delete(
        ApiConstants.comments,
        queryParameters: {'videoId': videoId, 'commentId': commentId},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error deleting comment $commentId: $e');
      return false;
    }
  }
}

class CommentPostResult {
  final Comment? comment;
  final bool flagged;
  final bool requiresSignIn;
  final String? error;

  CommentPostResult({
    this.comment,
    this.flagged = false,
    this.requiresSignIn = false,
    this.error,
  });

  bool get success => comment != null;
}
