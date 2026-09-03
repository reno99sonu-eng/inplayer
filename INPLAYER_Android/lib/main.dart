import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:permission_handler/permission_handler.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'features/auth/presentation/screens/splash_screen.dart';
import 'features/auth/presentation/screens/biometric_lock_screen.dart';
import 'features/safety/presentation/widgets/face_scan_modal.dart';
import 'services/content_access_service.dart';
import 'services/geo_service.dart';
import 'services/video_service.dart';
import 'providers/kid_mode_provider.dart';
import 'services/platform_update_service.dart';
import 'services/device_location_service.dart';
import 'services/face_age_detector_service.dart';
import 'providers/theme_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Must be initialized before any AudioPlayer used by MusicPlayerService
  // is created — sets up the background audio service/notification channel
  // that gives the new Music section real lock-screen/notification controls.
  // Unlike the Amplify config note below, this is a local plugin
  // registration (no network call), so awaiting it here doesn't meaningfully
  // delay the first painted frame.
  try {
    await JustAudioBackground.init(
      androidNotificationChannelId: 'in.inplayer.app.channel.audio',
      androidNotificationChannelName: 'InPlayer Music playback',
      androidNotificationOngoing: true,
      androidNotificationIcon: 'mipmap/ic_launcher',
      androidStopForegroundOnPause: false,
      androidNotificationClickStartsActivity: true,
    );
  } catch (e) {
    debugPrint('JustAudioBackground init warning: $e');
  }

  // Amplify configuration used to be awaited right here, which blocked
  // runApp() — and therefore the very first painted frame, not even the
  // splash animation could show — on every single cold start. It's removed
  // from this function entirely rather than made fire-and-forget in place,
  // because AuthNotifier._init() (providers/auth_provider.dart) already
  // calls AuthService().configureAmplify() as its own first step the moment
  // authStateProvider is first read (which happens right away — the router
  // and the splash screen both watch it). Running it here too would mean
  // two separate AuthService instances (configureAmplify()'s "already
  // configured" guard is a plain instance field, not global) racing to call
  // Amplify.addPlugin()/Amplify.configure() concurrently instead of safely
  // one after the other. AuthNotifier is now the single place that
  // configures Amplify. The video prefetch below already tolerates Amplify
  // not being ready yet — dio_client.dart's interceptor just proceeds
  // without an Authorization header (same as a signed-out request) if
  // fetchAuthSession() isn't available.

  // Defer feed preloading until the user actually reaches the home screen.
  // Eager startup fetches add cold-start latency and unnecessary work when the
  // user is still on the splash or auth flow; the home feed itself already
  // handles lazy loading and caching.
  runApp(const ProviderScope(child: InplayerApp()));
}

class InplayerApp extends ConsumerStatefulWidget {
  const InplayerApp({super.key});

  @override
  ConsumerState<InplayerApp> createState() => _InplayerAppState();
}

class _InplayerAppState extends ConsumerState<InplayerApp> {
  bool _splashVisible = true;
  bool _startupScanStarted = false;
  bool _startupScanComplete = false;
  bool _geoBlocked = false;
  Future<void>? _startupPermissionsFuture;
  final _scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    // Ask at the first Flutter frame, before the branded splash finishes.
    // Requests are deliberately sequential because Android may discard a
    // second system permission dialog shown while the first is open.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startupPermissionsFuture = _requestStartupPermissions();
      unawaited(_startupPermissionsFuture!);
    });
  }

  Future<void> _requestStartupPermissions() async {
    try {
      await Permission.locationWhenInUse.request();
      // Camera is deliberately NOT requested here. Asking for it this early
      // means the OS permission dialog fires before the person has seen any
      // explanation of what it's for or why — FaceScanModal requests it
      // itself, with its "InPlayer Safety — on-device face verification"
      // branding already on screen at that point, which is closer to
      // informed consent than a bare system dialog on a black screen.
    } catch (e) {
      debugPrint('[InPlayer] Startup permission request failed: $e');
    }
  }

  void _beginStartupAgeScan() {
    if (_startupScanStarted) return;
    _startupScanStarted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_runStartupAgeScan());
    });
  }

  Future<void> _runStartupAgeScan() async {
    if (!mounted) return;

    // If the system dialog is still visible, wait for the user's response
    // before starting geo verification or opening the camera sheet.
    await _startupPermissionsFuture;
    if (!mounted) return;

    // Request location before camera so Android does not drop one of two
    // simultaneous permission dialogs during a cold start.
    final geoResult = await requestDeviceLocation(ref.read(geoServiceProvider));
    if (!mounted) return;
    if (!geoResult.allowed) {
      debugPrint(
        '[InPlayer] Device is outside the supported region: ${geoResult.country}',
      );
      setState(() {
        _geoBlocked = true;
        _startupScanComplete = true;
        _splashVisible = false;
      });
      return;
    }

    final navContext = rootNavigatorKey.currentContext;
    FaceScanResult? result;
    if (navContext != null && navContext.mounted) {
      try {
        result = await FaceScanModal.show(navContext, startupScan: true);
      } catch (e) {
        debugPrint('[InPlayer] Startup face scan error: $e');
      }
    }
    if (!mounted) return;

    // Read persisted preference from SharedPreferences
    final prefs = await SharedPreferences.getInstance();
    final savedKidMode = prefs.getBool('inplayer:kids_mode_enabled') ?? false;

    // Content filtering based on face scan and user preference:
    // If the user previously turned ON Kids Mode toggle, keep Kids Mode.
    // If Kids Mode toggle is OFF (default):
    // Face scan dynamically and immediately filters content for the person in front of camera:
    //   - Minor/Child detected (<13) -> Kids content only (AudienceMode.kids)
    //   - Adult/Standard (13+) -> Standard content (AudienceMode.family)
    //   - No face / Skipped -> Fallback to Standard content (AudienceMode.family)
    // NO PASSKEY / PASSCODE IS EVER REQUESTED ON STARTUP / FACE SCAN!
    AudienceMode mode;
    if (savedKidMode) {
      mode = AudienceMode.kids;
    } else if (result != null) {
      mode = result.isChild ? AudienceMode.kids : AudienceMode.family;
    } else {
      mode = AudienceMode.family;
    }

    final accessService = ref.read(contentAccessServiceProvider);
    await ref
        .read(kidModeProvider.notifier)
        .setKidMode(mode == AudienceMode.kids);
    await accessService.setModeLocally(mode);
    VideoService.clearAudienceCaches();
    ref.read(contentAccessRevisionProvider.notifier).state++;
    if (mounted) setState(() => _startupScanComplete = true);
    _showAudienceFlashCard(mode, fromScan: result != null && !savedKidMode);
  }

  /// The small, dismissible confirmation the person sees once they're
  /// actually in the app — separate from the full-screen scan UI itself,
  /// which they've already seen close by this point. Deliberately honest
  /// about what happened rather than implying certainty: this is a default,
  /// not a verified fact about the viewer, and it says so.
  void _showAudienceFlashCard(AudienceMode mode, {required bool fromScan}) {
    final messenger = _scaffoldMessengerKey.currentState;
    if (messenger == null) return;

    final String message;
    switch (mode) {
      case AudienceMode.kids:
        message = fromScan
            ? "Estimated a younger viewer — starting in Kids Mode. Change it anytime in Settings."
            : 'Starting in Kids Mode.';
        break;
      case AudienceMode.family:
        message = fromScan
            ? 'Starting in Standard Mode. Change it anytime in Settings.'
            : 'Starting in Standard Mode.';
        break;
      case AudienceMode.all:
        message = 'Starting in All Content mode.';
        break;
    }

    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 4),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);
    // Keep one process-wide AppSync subscription alive above the router.
    ref.watch(platformUpdateServiceProvider);

    return MaterialApp.router(
      title: 'INPLAYER',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      scaffoldMessengerKey: _scaffoldMessengerKey,
      routerConfig: router,
      builder: (context, child) {
        return Stack(
          fit: StackFit.expand,
          children: [
            ?child,
            if (_geoBlocked) const _RegionBlockedOverlay(),
            // FloatingAIButton used to live here, above the router, so it
            // floated over EVERY route — watch, shorts, chat, settings,
            // checkout. It now belongs to the Home tab only and is mounted
            // in home_page.dart instead.
            if (!_geoBlocked)
              SplashScreenOverlay(
                onDismiss: () {
                  if (!mounted) return;
                  setState(() => _splashVisible = false);
                  _beginStartupAgeScan();
                },
              ),
            // Age safety runs first; biometric unlock must not cover or race
            // the camera route. It is mounted only after audience filtering
            // has completed.
            if (!_geoBlocked && !_splashVisible && _startupScanComplete)
              const BiometricLockScreen(),
          ],
        );
      },
    );
  }
}

class _RegionBlockedOverlay extends StatelessWidget {
  const _RegionBlockedOverlay();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.scaffoldBackgroundColor,
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.public_off_rounded,
                  size: 64,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: 20),
                Text(
                  'InPlayer is not available in your region',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Access is restricted to India. Disable any VPN or proxy and try again.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyLarge,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
