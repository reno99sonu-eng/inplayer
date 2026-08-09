import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'services/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Amplify before runApp
  final authService = AuthService();
  try {
    await authService.configureAmplify();
  } catch (e) {
    print('Amplify configuration error: $e');
  }

  runApp(const ProviderScope(child: InplayerApp()));
}

class InplayerApp extends ConsumerWidget {
  const InplayerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'INPLAYER',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      routerConfig: router,
    );
  }
}
