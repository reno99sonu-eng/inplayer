import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../providers/auth_provider.dart';
import 'notification_service.dart';

/// The live unread-notification count behind bell icons
/// (home_page.dart's header, shop_page.dart, and channel_page.dart's app bar)
/// — a single shared instance so they always agree.
class NotificationBadgeService extends ChangeNotifier with WidgetsBindingObserver {
  NotificationBadgeService(this._notificationService) {
    WidgetsBinding.instance.addObserver(this);
  }

  final NotificationService _notificationService;
  final _logger = Logger();
  bool _loading = false;
  Timer? _pollingTimer;

  int _unreadCount = 0;
  int get unreadCount => _unreadCount;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      refresh();
    }
  }

  /// Starts periodic background checking every 45s while authenticated
  void startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 45), (_) {
      refresh();
    });
  }

  /// Stops periodic background checking
  void stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  /// Re-fetches the real unread count from the backend.
  Future<void> refresh() async {
    if (_loading) return;
    _loading = true;
    try {
      final notifications = await _notificationService.getNotifications();
      _unreadCount = notifications.where((n) => !n.read).length;
      notifyListeners();
    } catch (e, stackTrace) {
      _logger.e('Failed to refresh notification badge', error: e, stackTrace: stackTrace);
    } finally {
      _loading = false;
    }
  }

  /// Zeroes the badge immediately — call the moment the notifications
  /// screen opens, matching optimistic clear-on-open.
  void clear() {
    if (_unreadCount == 0) return;
    _unreadCount = 0;
    notifyListeners();
  }

  /// Back to signed-out state.
  void reset() {
    stopPolling();
    if (_unreadCount == 0) return;
    _unreadCount = 0;
    notifyListeners();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    stopPolling();
    super.dispose();
  }
}

final notificationBadgeServiceProvider = ChangeNotifierProvider<NotificationBadgeService>((ref) {
  final service = NotificationBadgeService(ref.read(notificationServiceProvider));

  ref.listen<AuthState>(authStateProvider, (previous, next) {
    if (next is AuthStateAuthenticated) {
      service.refresh();
      service.startPolling();
    } else if (next is AuthStateUnauthenticated) {
      service.reset();
    }
  }, fireImmediately: true);

  return service;
});
