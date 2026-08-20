import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';

final premiumServiceProvider = Provider<PremiumService>((ref) {
  return PremiumService();
});

class PremiumService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<String> getMaxResolution() async {
    try {
      final response = await _dio.get('/api/premium/me');
      if (response.statusCode == 200 && response.data != null) {
        return response.data['maxResolution'] as String? ?? '1080p';
      }
    } catch (e) {
      _logger.e('Error fetching premium status: $e');
    }
    return '1080p'; // Fallback to free tier ceiling
  }
}
