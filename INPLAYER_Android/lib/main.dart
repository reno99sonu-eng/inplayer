import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'features/auth/presentation/screens/splash_screen.dart';
import 'features/auth/presentation/screens/biometric_lock_screen.dart';
import 'providers/theme_provider.dart';
import 'services/video_service.dart';
import 'models/video.dart';

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

  // Pre-warm real video feeds in background for 0ms instant render
  VideoService().getVideos().catchError((_) => <Video>[]);
  VideoService().getFeaturedWeekly().catchError((_) => <Video>[]);

  runApp(const ProviderScope(child: InplayerApp()));
}

class InplayerApp extends ConsumerWidget {
  const InplayerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'INPLAYER',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      routerConfig: router,
      builder: (context, child) {
        return Stack(
          children: [
            ?child,
            const SplashScreenOverlay(),
            const BiometricLockScreen(),
          ],
        );
      },
    );
  }
}
