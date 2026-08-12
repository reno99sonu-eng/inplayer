import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/live_stream.dart';

final liveServiceProvider = Provider<LiveService>((ref) {
  return LiveService();
});

/// Broadcaster-side live streaming — mirrors app/api/live/{ivs-create,end}.
/// See api_constants.dart for why there's no "watch someone else's live
/// stream" method here: that path has no REST endpoint on the backend.
class LiveService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// Creates a real AWS IVS channel + InPlayer-Videos record (status:
  /// "live"), exactly like the website's "Start Broadcast" button. On
  /// success this also fans out live-stream notifications to the
  /// broadcaster's subscribers server-side, same as the website.
  Future<LiveCreateResult> goLive({
    required String title,
    String description = '',
    String visibility = 'public',
    bool commentsEnabled = true,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.liveCreate,
        data: {
          'title': title,
          'description': description,
          'visibility': visibility,
          'commentsEnabled': commentsEnabled,
        },
      );
      if (response.statusCode == 200 && response.data is Map) {
        return LiveCreateResult.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return LiveCreateResult(success: false, error: error ?? "Couldn't start a live stream.");
    } catch (e) {
      _logger.e('Error creating live stream: $e');
      return LiveCreateResult(success: false, error: "Couldn't start a live stream. Try again.");
    }
  }

  /// Ends the stream — flips the InPlayer-Videos record to "processing" so
  /// it stops appearing as live (matches the website's own end-of-stream
  /// behavior; a real recorded VOD would need IVS Auto-Record-to-S3 +
  /// EventBridge wired up server-side, which is unchanged either way).
  Future<bool> endLive(String videoId) async {
    try {
      final response = await _dio.post(ApiConstants.liveEnd, data: {'videoId': videoId});
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error ending live stream: $e');
      return false;
    }
  }
}
