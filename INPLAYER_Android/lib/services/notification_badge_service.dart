import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../providers/auth_provider.dart';
import 'notification_service.dart';

/// The live unread-notification count behind both bell icons
/// (home_page.dart's header and channel_page.dart's app bar) — a single
/// shared instance so they always agree, mirroring the website's real
/// bell (app/components/NavbarActions.tsx) exactly: fetched once when the
/// person signs in (not polled), and cleared optimistically the instant
/// the notifications screen opens — before the mark-all-read request to
/// the backend even resolves — rather than waiting on the round trip.
class NotificationBadgeService extends ChangeNotifier {
  NotificationBadgeService(this._notificationService);

  final NotificationService _notificationService;
  final _logger = Logger();
  bool _loading = false;

  int _unreadCount = 0;
  int get unreadCount => _unreadCount;

  /// Re-fetches the real unread count from the backend. Called on sign-in
  /// by the provider below; safe to call again anywhere a fresh count is
  /// wanted (e.g. after a pull-to-refresh).
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
  /// screen opens, matching the website's optimistic clear-on-open.
  void clear() {
    if (_unreadCount == 0) return;
    _unreadCount = 0;
    notifyListeners();
  }

  /// Back to signed-out state.
  void reset() {
    if (_unreadCount == 0) return;
    _unreadCount = 0;
    notifyListeners();
  }
}

final notificationBadgeServiceProvider = ChangeNotifierProvider<NotificationBadgeService>((ref) {
  final service = NotificationBadgeService(ref.read(notificationServiceProvider));

  // Parity with the website's `useEffect(..., [signedIn])`: fetch the real
  // count the moment someone is signed in (including "already signed in
  // when this provider first spins up", via fireImmediately), and drop it
  // back to zero on sign-out.
  ref.listen<AuthState>(authStateProvider, (previous, next) {
    if (next is AuthStateAuthenticated) {
      service.refresh();
    } else if (next is AuthStateUnauthenticated) {
      service.reset();
    }
  }, fireImmediately: true);

  return service;
});
