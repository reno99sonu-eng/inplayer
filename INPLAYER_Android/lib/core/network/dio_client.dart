import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:logger/logger.dart';
import '../config/app_config.dart';

class DioClient {
  static final DioClient _instance = DioClient._internal();
  factory DioClient() => _instance;

  late final Dio _dio;
  final _logger = Logger();
  final _storage = const FlutterSecureStorage();

  DioClient._internal() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
        headers: {'Content-Type': 'application/json'},
        validateStatus: (status) => status != null && status < 500,
      ),
    );

    _setupInterceptors();
  }

  void _setupInterceptors() {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Add auth token if available
          final token = await _storage.read(key: 'auth_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          _logger.d('Request: ${options.method} ${options.uri}');
          return handler.next(options);
        },
        onResponse: (response, handler) {
          _logger.d(
            'Response: ${response.statusCode} ${response.requestOptions.uri}',
          );
          return handler.next(response);
        },
        onError: (error, handler) {
          _logger.e('Error: ${error.requestOptions.uri} - ${error.message}');

          // Handle 401 Unauthorized
          if (error.response?.statusCode == 401) {
            _handleUnauthorized();
          }

          return handler.next(error);
        },
      ),
    );
  }

  Future<void> _handleUnauthorized() async {
    // Clear stored tokens
    await _storage.delete(key: 'auth_token');
    await _storage.delete(key: 'refresh_token');
    // Navigation to login screen will be handled by the auth state listener
  }

  Dio get dio => _dio;

  Future<void> setAuthToken(String token) async {
    await _storage.write(key: 'auth_token', value: token);
  }

  Future<void> clearAuthTokens() async {
    await _storage.delete(key: 'auth_token');
    await _storage.delete(key: 'refresh_token');
  }

  Future<String?> getAuthToken() async {
    return await _storage.read(key: 'auth_token');
  }
}
