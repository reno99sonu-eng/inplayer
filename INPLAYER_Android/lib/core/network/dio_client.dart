import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:logger/logger.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
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
          // Attach the live Cognito ID token on every request, the same way
          // the InPlayer website's own authedFetch() helper
          // (app/lib/apiFetch.ts) does it: pull a fresh session from
          // Amplify right before the call instead of trusting a token
          // cached at sign-in time. Cognito ID tokens expire (~1 hour) and
          // Amplify silently refreshes them internally, so this always
          // sends a currently-valid token without us managing expiry
          // ourselves.
          //
          // This was previously reading a manually-stored 'auth_token' key
          // that nothing in the app ever wrote — so every authenticated
          // call (likes, subscriptions, comments, watch history, uploads,
          // messages, admin, etc.) was silently sent with NO Authorization
          // header at all and the backend's verifyAuth() rejected it. Sign
          // in itself still "worked" because that talks to Cognito
          // directly and never went through this header.
          try {
            final authSession = await Amplify.Auth.fetchAuthSession();
            if (authSession is CognitoAuthSession) {
              final idToken =
                  authSession.userPoolTokensResult.valueOrNull?.idToken.raw;
              if (idToken != null && idToken.isNotEmpty) {
                options.headers['Authorization'] = 'Bearer $idToken';
              }
            }
          } catch (e) {
            // Not signed in, Amplify not configured yet, or the session
            // expired. Proceed without the header — the backend will 401
            // if the endpoint actually requires auth, same as a
            // signed-out browser hitting it.
            _logger.d('No auth session available for request: $e');
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
          return handler.next(error);
        },
      ),
    );
  }

  Dio get dio => _dio;

  // Legacy manual-token helpers. No longer used for the Authorization
  // header (see onRequest above, which now reads live from Amplify on
  // every request) — kept only in case something still calls them.
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
