import 'dart:async';
import 'dart:convert';

import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/config/app_config.dart';
import '../providers/auth_provider.dart';
import 'video_service.dart';

class PlatformUpdateEvent {
  final String entityType;
  final String entityId;
  final String action;
  final DateTime updatedAt;

  const PlatformUpdateEvent({
    required this.entityType,
    required this.entityId,
    required this.action,
    required this.updatedAt,
  });

  factory PlatformUpdateEvent.fromJson(Map<String, dynamic> json) {
    return PlatformUpdateEvent(
      entityType: json['entityType']?.toString() ?? '',
      entityId: json['entityId']?.toString() ?? '',
      action: json['action']?.toString() ?? '',
      updatedAt:
          DateTime.tryParse(json['updatedAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

final platformUpdateRevisionProvider = StateProvider<int>((ref) => 0);

/// Owns one AppSync subscription for the lifetime of the app. Amplify's
/// Cognito User Pools auth provider supplies the current refreshed Cognito
/// session to the AppSync WebSocket; no access/refresh token is stored here.
final platformUpdateServiceProvider = Provider<PlatformUpdateService>((ref) {
  final service = PlatformUpdateService(ref);
  ref.onDispose(service.dispose);
  service.start();
  return service;
});

class PlatformUpdateService {
  PlatformUpdateService(this._ref);

  final Ref _ref;
  final _logger = Logger();
  StreamSubscription<GraphQLResponse<String>>? _subscription;
  Timer? _retryTimer;
  bool _disposed = false;
  bool _starting = false;
  int _retryAttempt = 0;

  static const _document = r'''
subscription PlatformUpdated {
  platformUpdated {
    entityType
    entityId
    action
    updatedAt
  }
}
''';

  void start() {
    if (_disposed || _starting || _subscription != null) return;
    if (AppConfig.appSyncGraphqlEndpoint.trim().isEmpty) return;
    _starting = true;
    unawaited(_connect());
  }

  Future<void> _connect() async {
    try {
      final stream = Amplify.API.subscribe<String>(
        GraphQLRequest<String>(
          document: _document,
          apiName: 'InPlayerAppSync',
          authorizationMode: APIAuthorizationType.userPools,
        ),
        onEstablished: () {
          _retryAttempt = 0;
          _logger.i('AppSync platform update subscription established');
        },
      );
      _subscription = stream.listen(
        _handleResponse,
        onError: (Object error, StackTrace stack) {
          _logger.w('AppSync platform update subscription error: $error');
          _closeAndRetry();
        },
        onDone: _closeAndRetry,
        cancelOnError: true,
      );
    } catch (error) {
      _logger.w('Could not start AppSync subscription: $error');
      _scheduleRetry();
    } finally {
      _starting = false;
    }
  }

  void _handleResponse(GraphQLResponse<String> response) {
    if (response.errors.isNotEmpty) {
      _logger.w('AppSync subscription response error: ${response.errors}');
      return;
    }
    final raw = response.data;
    if (raw == null || raw.isEmpty) return;
    try {
      final decoded = jsonDecode(raw);
      final event = decoded is Map && decoded['platformUpdated'] is Map
          ? PlatformUpdateEvent.fromJson(
              Map<String, dynamic>.from(decoded['platformUpdated'] as Map),
            )
          : null;
      if (event != null) _apply(event);
    } catch (error) {
      _logger.w('Invalid AppSync platform update payload: $error');
    }
  }

  void _apply(PlatformUpdateEvent event) {
    final type = event.entityType.toLowerCase();
    final current = _ref.read(authStateProvider);
    final currentUserId = current is AuthStateAuthenticated
        ? current.user.userId
        : null;

    if (type == 'user' || type == 'inplayer-users') {
      if (currentUserId == null || event.entityId == currentUserId) {
        unawaited(_ref.read(authStateProvider.notifier).refreshUser());
      }
    }
    if (type == 'video' || type == 'inplayer-videos') {
      VideoService.clearAudienceCaches();
    }

    // All consumers can cheaply use this revision to invalidate their own
    // screen-level cache. The event itself remains available in logs only;
    // no user data is persisted by the listener.
    _ref.read(platformUpdateRevisionProvider.notifier).state++;
  }

  void _closeAndRetry() {
    final active = _subscription;
    _subscription = null;
    unawaited(active?.cancel() ?? Future<void>.value());
    _scheduleRetry();
  }

  void _scheduleRetry() {
    if (_disposed || _retryTimer != null) return;
    final seconds = (1 << _retryAttempt.clamp(0, 5)).clamp(1, 30);
    _retryAttempt++;
    _retryTimer = Timer(Duration(seconds: seconds), () {
      _retryTimer = null;
      start();
    });
  }

  void dispose() {
    _disposed = true;
    _retryTimer?.cancel();
    _retryTimer = null;
    final active = _subscription;
    _subscription = null;
    unawaited(active?.cancel() ?? Future<void>.value());
  }
}
