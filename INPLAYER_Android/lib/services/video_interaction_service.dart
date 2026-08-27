import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';

final videoInteractionServiceProvider = Provider<VideoInteractionService>((ref) {
  return VideoInteractionService();
});

/// Wraps the two smaller watch-page ⋮ options-menu endpoints that don't
/// have their own service yet: recommendation feedback (Interested / Not
/// Interested) and reports. Mirrors app/api/video-feedback/route.ts and
/// app/api/reports/route.ts, confirmed against
/// app/components/watch/VideoOptionsMenu.tsx.
class VideoInteractionService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// Every "interested"/"not_interested" mark the signed-in viewer has ever
  /// made, keyed by videoId. Used to preselect this video's current state
  /// when the options sheet opens.
  Future<Map<String, String>> getFeedbackMap() async {
    try {
      final response = await _dio.get(ApiConstants.videoFeedback);
      if (response.statusCode == 200 && response.data is Map) {
        final raw = (response.data as Map)['feedback'];
        if (raw is Map) {
          return raw.map((k, v) => MapEntry(k.toString(), v.toString()));
        }
      }
    } catch (e) {
      _logger.e('Error fetching feedback map: $e');
    }
    return {};
  }

  /// Same-value-clears convention on the backend: sending the value that's
  /// already active clears it back to null. `ok` distinguishes a real
  /// server-confirmed result (where `feedback` may legitimately be null,
  /// meaning "cleared") from a failed request (where the caller should
  /// revert to whatever was showing before).
  Future<({bool ok, String? feedback})> submitFeedback(String videoId, String feedback) async {
    try {
      final response = await _dio.post(
        ApiConstants.videoFeedback,
        data: {'videoId': videoId, 'feedback': feedback},
      );
      if (response.statusCode == 200 && response.data is Map) {
        return (ok: true, feedback: (response.data as Map)['feedback'] as String?);
      }
    } catch (e) {
      _logger.e('Error submitting feedback for $videoId: $e');
    }
    return (ok: false, feedback: null);
  }

  Future<bool> isReported(String videoId) async {
    try {
      final response = await _dio.get(
        ApiConstants.reports,
        queryParameters: {'videoId': videoId},
      );
      if (response.statusCode == 200 && response.data is Map) {
        return (response.data as Map)['reported'] == true;
      }
    } catch (e) {
      _logger.e('Error checking report status for $videoId: $e');
    }
    return false;
  }

  Future<bool> submitReport({
    required String videoId,
    required String reason,
    String details = '',
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.reports,
        data: {'videoId': videoId, 'reason': reason, 'details': details},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error submitting report for $videoId: $e');
      return false;
    }
  }
}

/// The 8 fixed report reasons — matches REPORT_REASONS in
/// VideoOptionsMenu.tsx exactly (value must stay in sync with the backend's
/// accepted enum).
const List<Map<String, String>> kReportReasons = [
  {'value': 'spam', 'label': 'Spam or misleading'},
  {'value': 'harassment', 'label': 'Harassment or bullying'},
  {'value': 'sexual_content', 'label': 'Sexual content'},
  {'value': 'hate_speech', 'label': 'Hate speech'},
  {'value': 'violence', 'label': 'Violent or graphic content'},
  {'value': 'misinformation', 'label': 'Misinformation'},
  {'value': 'copyright', 'label': 'Copyright infringement'},
  {'value': 'other', 'label': 'Something else'},
];
