import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../providers/auth_provider.dart';
import '../widgets/sign_in_modal.dart';
import '../widgets/sign_up_modal.dart';
import '../widgets/forgot_password_modal.dart';

enum SignUpViewMode { signUp, signIn, forgotPassword }

class SignUpPage extends ConsumerStatefulWidget {
  const SignUpPage({super.key});

  @override
  ConsumerState<SignUpPage> createState() => _SignUpPageState();
}

class _SignUpPageState extends ConsumerState<SignUpPage> {
  SignUpViewMode _mode = SignUpViewMode.signUp;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);

    if (authState is AuthStateAuthenticated) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go('/');
      });
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: PatternBackground(
        child: SafeArea(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: _buildCurrentView(),
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentView() {
    switch (_mode) {
      case SignUpViewMode.signUp:
        return SignUpModal(
          key: const ValueKey('sign_up'),
          onClose: () => context.go('/'),
          onSuccess: () => context.go('/'),
          onSwitchToSignIn: () => setState(() => _mode = SignUpViewMode.signIn),
        );
      case SignUpViewMode.signIn:
        return SignInModal(
          key: const ValueKey('sign_in'),
          onClose: () => context.go('/'),
          onSuccess: () => context.go('/'),
          onSwitchToSignUp: () => setState(() => _mode = SignUpViewMode.signUp),
          onSwitchToForgotPassword: () => setState(() => _mode = SignUpViewMode.forgotPassword),
        );
      case SignUpViewMode.forgotPassword:
        return ForgotPasswordModal(
          key: const ValueKey('forgot_password'),
          onClose: () => context.go('/'),
          onSwitchToSignIn: () => setState(() => _mode = SignUpViewMode.signIn),
        );
    }
  }
}
