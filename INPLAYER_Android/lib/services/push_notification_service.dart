import 'dart:async';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logger/logger.dart';

import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';
import '../core/router/app_router.dart';

final pushNotificationServiceProvider = Provider<PushNotificationService>((ref) {
  return PushNotificationService();
});

// Must match AndroidManifest.xml's com.google.firebase.messaging.
// default_notification_channel_id meta-data exactly — that's what makes an
// FCM message shown while the app is backgrounded/terminated (which Android
// itself posts, no app code involved) land in the SAME channel this class
// creates and posts to for foreground messages, so a person controlling
// notification behavior in system Settings is controlling one real thing,
// not two different-looking ones.
const String _pushChannelId = 'in.inplayer.app.channel.push';
const String _pushChannelName = 'InPlayer notifications';
const String _pushChannelDescription =
    'New subscribers, comments, likes and messages';

/// Runs in its own isolate — Android spawns a fresh one for this, separate
/// from the app's normal running instance, so nothing here can touch
/// widget/provider state. Its only job is letting the OS finish delivering
/// the message; Android itself is what actually shows the notification for
/// a backgrounded/terminated app, using the "notification" block of the
/// payload and the default channel declared in AndroidManifest.xml — this
/// handler does not need to (and structurally cannot) draw any UI.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Deliberately empty. Registering a handler at all — even a no-op one —
  // is what firebase_messaging requires to guarantee this app process is
  // properly woken for a background/terminated-state message in the first
  // place; without one, delivery to this state is not reliable.
}

/// Wraps Firebase Cloud Messaging: device token registration with the
/// backend, and displaying an actual notification while the app is in the
/// FOREGROUND (FCM does not do this itself by design — background/
/// terminated delivery is handled natively by Android once
/// [firebaseMessagingBackgroundHandler] above is registered).
class PushNotificationService {
  final _dio = DioClient().dio;
  final _logger = Logger();
  final _localNotifications = FlutterLocalNotificationsPlugin();

  bool _initialized = false;
  String? _registeredToken;

  /// Sets up local-notification display and the foreground/tap listeners.
  /// Safe to call more than once — every real call site only ever runs
  /// this once in practice, but nothing here assumes that.
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    if (!Platform.isAndroid) return; // No iOS app exists yet.

    try {
      const androidInit = AndroidInitializationSettings('ic_launcher');
      await _localNotifications.initialize(
        settings: const InitializationSettings(android: androidInit),
        onDidReceiveNotificationResponse: (_) => _openNotificationsScreen(),
      );

      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          _pushChannelId,
          _pushChannelName,
          description: _pushChannelDescription,
          importance: Importance.max,
        ),
      );

      // Foreground: FCM never shows a notification for this state on its
      // own — draw one explicitly so a message that arrives while the app
      // is open is just as visible as one that arrives while it's closed.
      FirebaseMessaging.onMessage.listen(_showForegroundNotification);

      // Tapped from background (app was already running, just minimized).
      FirebaseMessaging.onMessageOpenedApp.listen((_) => _openNotificationsScreen());

      // Tapped from fully terminated — the message that actually launched
      // the app this time, consumed once.
      final launchMessage = await FirebaseMessaging.instance.getInitialMessage();
      if (launchMessage != null) _openNotificationsScreen();
    } catch (e) {
      _logger.w('Push notification initialize() failed: $e');
    }
  }

  void _showForegroundNotification(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;
    unawaited(
      _localNotifications.show(
        id: message.hashCode,
        title: notification.title,
        body: notification.body,
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            _pushChannelId,
            _pushChannelName,
            channelDescription: _pushChannelDescription,
            importance: Importance.max,
            priority: Priority.high,
          ),
        ),
      ),
    );
  }

  /// Every notification this app sends is, for now, something worth
  /// checking in the one place that already lists them all — a simple,
  /// always-correct destination rather than guessing at a specific video/
  /// conversation route per notification type.
  void _openNotificationsScreen() {
    final context = rootNavigatorKey.currentContext;
    if (context == null || !context.mounted) return;
    context.push('/notifications');
  }

  /// Asks for permission (Android 13+ prompts; no-op/pre-granted on older
  /// versions), then registers this device's current token with the
  /// backend against the signed-in user. Safe to call on every app open —
  /// re-registering the same token is a harmless upsert server-side, and
  /// this is also how a genuinely new token (reinstall, cleared data) gets
  /// picked up, since nothing else would ever notice that happened.
  Future<void> registerToken() async {
    if (!Platform.isAndroid) return;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        _logger.i('Push notification permission denied.');
        return;
      }

      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return;
      await _sendToken(token);

      // Fires again on its own if the token is ever replaced later in this
      // same app session (token rotation, not just first mint).
      FirebaseMessaging.instance.onTokenRefresh.listen(_sendToken);
    } catch (e) {
      _logger.w('registerToken() failed: $e');
    }
  }

  Future<void> _sendToken(String token) async {
    if (_registeredToken == token) return;
    try {
      final response = await _dio.post(
        ApiConstants.pushRegisterToken,
        data: {'token': token, 'platform': 'android'},
      );
      if (response.statusCode == 200) _registeredToken = token;
    } catch (e) {
      _logger.w('Failed to register push token: $e');
    }
  }

  /// Best-effort removal on sign-out, so a shared/logged-out device stops
  /// receiving push for an account no longer active on it. Never blocks
  /// sign-out on this — a failed delete here just means this one token
  /// keeps receiving pushes for the old account until it's naturally
  /// replaced (reinstall, token rotation), not a broken sign-out.
  Future<void> unregisterToken() async {
    final token = _registeredToken;
    if (token == null) return;
    _registeredToken = null;
    try {
      await _dio.delete(
        ApiConstants.pushRegisterToken,
        data: {'token': token},
      );
    } catch (e) {
      _logger.w('Failed to unregister push token: $e');
    }
  }
}
