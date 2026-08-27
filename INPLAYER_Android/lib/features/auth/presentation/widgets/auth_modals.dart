import 'package:flutter/material.dart';
import 'sign_in_modal.dart';
import 'sign_up_modal.dart';
import 'forgot_password_modal.dart';

enum _AuthModalView { signIn, signUp, forgotPassword }

class _AuthHostDialog extends StatefulWidget {
  final _AuthModalView initialView;
  final VoidCallback? onSuccess;

  const _AuthHostDialog({
    this.initialView = _AuthModalView.signIn,
    this.onSuccess,
  });

  @override
  State<_AuthHostDialog> createState() => _AuthHostDialogState();
}

class _AuthHostDialogState extends State<_AuthHostDialog> {
  late _AuthModalView _currentView;

  @override
  void initState() {
    super.initState();
    _currentView = widget.initialView;
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (child, anim) {
          return FadeTransition(
            opacity: anim,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.96, end: 1.0).animate(anim),
              child: child,
            ),
          );
        },
        child: _buildCurrentView(),
      ),
    );
  }

  Widget _buildCurrentView() {
    switch (_currentView) {
      case _AuthModalView.signIn:
        return SignInModal(
          key: const ValueKey('signIn'),
          onSuccess: widget.onSuccess,
          onSwitchToSignUp: () => setState(() => _currentView = _AuthModalView.signUp),
          onSwitchToForgotPassword: () => setState(() => _currentView = _AuthModalView.forgotPassword),
        );
      case _AuthModalView.signUp:
        return SignUpModal(
          key: const ValueKey('signUp'),
          onSuccess: widget.onSuccess,
          onSwitchToSignIn: () => setState(() => _currentView = _AuthModalView.signIn),
        );
      case _AuthModalView.forgotPassword:
        return ForgotPasswordModal(
          key: const ValueKey('forgotPassword'),
          onSwitchToSignIn: () => setState(() => _currentView = _AuthModalView.signIn),
        );
    }
  }
}

Future<void> showSignInModal(BuildContext context, {VoidCallback? onSuccess}) {
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Sign In',
    barrierColor: Colors.black.withValues(alpha: 0.75),
    transitionDuration: const Duration(milliseconds: 250),
    pageBuilder: (ctx, anim1, anim2) {
      return _AuthHostDialog(
        initialView: _AuthModalView.signIn,
        onSuccess: onSuccess,
      );
    },
    transitionBuilder: (ctx, anim1, anim2, child) {
      return FadeTransition(
        opacity: anim1,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.94, end: 1.0).animate(
            CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
          ),
          child: child,
        ),
      );
    },
  );
}

Future<void> showSignUpModal(BuildContext context, {VoidCallback? onSuccess}) {
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Sign Up',
    barrierColor: Colors.black.withValues(alpha: 0.75),
    transitionDuration: const Duration(milliseconds: 250),
    pageBuilder: (ctx, anim1, anim2) {
      return _AuthHostDialog(
        initialView: _AuthModalView.signUp,
        onSuccess: onSuccess,
      );
    },
    transitionBuilder: (ctx, anim1, anim2, child) {
      return FadeTransition(
        opacity: anim1,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.94, end: 1.0).animate(
            CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
          ),
          child: child,
        ),
      );
    },
  );
}
