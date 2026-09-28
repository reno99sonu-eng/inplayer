import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';

final presenceServiceProvider = Provider<PresenceService>((ref) {
  return PresenceService();
});

/// Sends the same foreground heartbeat used by the website so the shared
/// lastActiveAt timestamp stays current while someone is using the app.
class PresenceService {
  final _dio = DioClient().dio;

  Future<void> heartbeat() async {
    try {
      await _dio.post(ApiConstants.presence);
    } catch (_) {
      // Presence is best-effort. A transient network error must never
      // interrupt playback or navigation; the next heartbeat retries it.
    }
  }
}
