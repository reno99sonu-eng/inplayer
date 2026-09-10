import 'dart:convert';
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

      dynamic data = response.data;
      if (data is String) {
        try {
          data = jsonDecode(data);
        } catch (e) {
          _logger.w('Failed to jsonDecode comments: $e');
        }
      }

      if (response.statusCode != 200 || data is! Map) {
        _logger.w('getComments non-200 or not Map: ${response.statusCode}');
        return [];
      }

      final commentsJson = data['comments'];
      if (commentsJson is! List) return [];

      final list = <Comment>[];
      for (final item in commentsJson) {
        if (item is Map) {
          try {
            list.add(Comment.fromJson(Map<String, dynamic>.from(item)));
          } catch (e) {
            _logger.w('Failed to parse comment item: $e, json: $item');
          }
        }
      }
      return list;
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
    String? parentCommentId,
    String? parentUserName,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.comments,
        data: {
          'videoId': videoId,
          'text': text,
          if (parentUserId != null && parentUserId.isNotEmpty)
            'parentUserId': parentUserId,
          if (parentCommentId != null && parentCommentId.isNotEmpty)
            'parentCommentId': parentCommentId,
          if (parentUserName != null && parentUserName.isNotEmpty)
            'parentUserName': parentUserName,
        },
      );

      dynamic data = response.data;
      if (data is String) {
        try {
          data = jsonDecode(data);
        } catch (_) {}
      }

      if (response.statusCode == 200 && data is Map) {
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

  /// React to a comment: like, dislike, or remove
  Future<CommentReactionResult> reactToComment({
    required String videoId,
    required String commentId,
    required String action, // 'like', 'dislike', 'remove'
  }) async {
    try {
      final response = await _dio.patch(
        ApiConstants.comments,
        data: {
          'videoId': videoId,
          'commentId': commentId,
          'action': action,
        },
      );

      dynamic data = response.data;
      if (data is String) {
        try {
          data = jsonDecode(data);
        } catch (_) {}
      }

      if (response.statusCode == 200 && data is Map) {
        return CommentReactionResult(
          success: true,
          likeCount: (data['likeCount'] as num?)?.toInt() ?? 0,
          dislikeCount: (data['dislikeCount'] as num?)?.toInt() ?? 0,
          myReaction: data['myReaction'] as String?,
        );
      }
      return CommentReactionResult(success: false);
    } catch (e) {
      _logger.e('Error reacting to comment $commentId: $e');
      return CommentReactionResult(success: false);
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

class CommentReactionResult {
  final bool success;
  final int likeCount;
  final int dislikeCount;
  final String? myReaction;

  CommentReactionResult({
    required this.success,
    this.likeCount = 0,
    this.dislikeCount = 0,
    this.myReaction,
  });
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
