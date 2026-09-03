import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../providers/auth_provider.dart';

class ForgotPasswordModal extends ConsumerStatefulWidget {
  final VoidCallback? onClose;
  final VoidCallback? onSwitchToSignIn;

  const ForgotPasswordModal({
    super.key,
    this.onClose,
    this.onSwitchToSignIn,
  });

  @override
  ConsumerState<ForgotPasswordModal> createState() => _ForgotPasswordModalState();
}

class _ForgotPasswordModalState extends ConsumerState<ForgotPasswordModal> {
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _newPasswordController = TextEditingController();
  bool _codeSent = false;

  /// The masked address Cognito says it sent the code to, e.g.
  /// `r***@g***.com`. Null means Cognito accepted the request but named no
  /// destination — worth showing, because that is the case where waiting for
  /// an email is futile.
  String? _sentTo;
  bool _loading = false;
  String? _error;
  bool _success = false;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _newPasswordController.dispose();
    super.dispose();
  }

  void _handleClose() {
    if (widget.onClose != null) {
      widget.onClose!();
    } else if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go('/');
    }
  }

  Future<void> _handleSendCode() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Please enter your account email.');
      return;
    }

    setState(() {
      _error = null;
      _loading = true;
    });

    try {
      final destination = await ref
          .read(authStateProvider.notifier)
          .resetPassword(email: email);
      if (mounted) {
        setState(() {
          _codeSent = true;
          _sentTo = destination;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _friendlyAuthError(e);
          _loading = false;
        });
      }
    }
  }

  /// Amplify's raw exceptions read like `AuthException {message: ...,
  /// recoverySuggestion: ...}`, which is no use to someone locked out of
  /// their account. These are the cases that actually happen.
  String _friendlyAuthError(Object e) {
    final message = e is AuthException ? e.message : e.toString();
    final lower = message.toLowerCase();

    if (lower.contains('user') && lower.contains('not') &&
        (lower.contains('exist') || lower.contains('found'))) {
      return 'No account found with that email address.';
    }
    if (lower.contains('verified email') ||
        lower.contains('no registered/verified')) {
      return "That account has no confirmed email address, so a code can't be "
          'sent to it. If you signed up with Google, use the Google button on '
          'the sign-in screen instead.';
    }
    if (lower.contains('limit exceeded') || lower.contains('too many')) {
      return 'Too many attempts. Wait a few minutes before trying again.';
    }
    if (lower.contains('expired')) {
      return 'That code has expired. Send yourself a new one.';
    }
    if (lower.contains('mismatch') ||
        (lower.contains('code') && lower.contains('invalid'))) {
      return "That code isn't right. Check it and try again.";
    }
    if (lower.contains('password') &&
        (lower.contains('policy') || lower.contains('length'))) {
      return "That password doesn't meet the requirements — use at least 8 "
          'characters with a mix of letters and numbers.';
    }
    if (lower.contains('network') || lower.contains('connection')) {
      return 'No connection. Check your internet and try again.';
    }
    return message;
  }

  Future<void> _handleResetPassword() async {
    final email = _emailController.text.trim();
    final code = _codeController.text.trim();
    final newPass = _newPasswordController.text;

    if (code.isEmpty || newPass.isEmpty) {
      setState(() => _error = 'Please enter the verification code and new password.');
      return;
    }

    setState(() {
      _error = null;
      _loading = true;
    });

    try {
      await ref.read(authStateProvider.notifier).confirmResetPassword(
            email: email,
            code: code,
            newPassword: newPass,
          );
      if (mounted) {
        setState(() {
          _success = true;
          _loading = false;
        });
        await Future.delayed(const Duration(milliseconds: 600));
        if (mounted) {
          if (widget.onSwitchToSignIn != null) {
            widget.onSwitchToSignIn!();
          } else if (Navigator.of(context).canPop()) {
            Navigator.of(context).pop();
          } else {
            context.go('/signin');
          }
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _friendlyAuthError(e);
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;

    return Center(
      child: Material(
        type: MaterialType.transparency,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 440),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: isDark
                    ? AppColors.brandOrange.withValues(alpha: 0.22)
                    : AppColors.brandOrange.withValues(alpha: 0.35),
                width: 1.5,
              ),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDark
                    ? const [
                        Color(0xFF07111F),
                        Color(0xFF0B1728),
                        Color(0xFF040A14),
                      ]
                    : const [
                        Color(0xFFFBF6EA),
                        Color(0xFFEDE2C9),
                        Color(0xFFFBF6EA),
                      ],
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.65 : 0.20),
                  blurRadius: 50,
                  offset: const Offset(0, 20),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(28),
              child: Stack(
                children: [
                  Positioned(
                    top: 16,
                    right: 16,
                    child: GestureDetector(
                      onTap: _handleClose,
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.06),
                          border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
                        ),
                        child: Icon(Icons.close_rounded, size: 18, color: context.textSecondary),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: _success ? _buildSuccess(context) : _buildForm(context, isDark),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSuccess(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 20),
        const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF34D399), size: 54),
        const SizedBox(height: 16),
        Text(
          'Password Updated!',
          style: TextStyle(color: context.textPrimary, fontSize: 20, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 6),
        Text(
          'You can now sign in with your new password.',
          style: TextStyle(color: context.textSecondary, fontSize: 13),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildForm(BuildContext context, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
          decoration: BoxDecoration(
            color: AppColors.brandOrange.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.35)),
          ),
          child: const Text(
            'INPLAYER',
            style: TextStyle(
              color: AppColors.brandOrange,
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.5,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Reset\nPassword.',
          style: TextStyle(
            color: context.textPrimary,
            fontSize: 26,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.8,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          _codeSent
              ? (_sentTo != null
                    // Naming the address it actually went to is the whole
                    // point: "check your email" is unfalsifiable, whereas a
                    // masked destination either matches your inbox or tells
                    // you immediately that it went somewhere else.
                    ? 'Enter the 6-digit code sent to $_sentTo.'
                    : 'We asked for a code, but no delivery address came '
                          'back for that account. Check the email is right, or '
                          'sign in with Google if that is how you signed up.')
              : 'Enter your email and we’ll send you a password reset code.',
          style: TextStyle(color: context.textSecondary, fontSize: 13),
        ),
        const SizedBox(height: 20),
        if (!_codeSent) ...[
          Text('Email', style: TextStyle(color: context.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          _buildInput(
            controller: _emailController,
            hint: 'you@example.com',
            icon: Icons.mail_outline_rounded,
            keyboardType: TextInputType.emailAddress,
            isDark: isDark,
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12)),
          ],
          const SizedBox(height: 20),
          GestureDetector(
            onTap: _loading ? null : _handleSendCode,
            child: Container(
              height: 48,
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: AppColors.flameGradient,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(
                child: _loading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A)))
                    : const Text(
                        'Send Reset Code',
                        style: TextStyle(color: Color(0xFF0F172A), fontSize: 15, fontWeight: FontWeight.w900),
                      ),
              ),
            ),
          ),
        ] else ...[
          Text('Reset Code', style: TextStyle(color: context.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          _buildInput(
            controller: _codeController,
            hint: '6-digit code',
            icon: Icons.pin_outlined,
            isDark: isDark,
          ),
          const SizedBox(height: 14),
          Text('New Password', style: TextStyle(color: context.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          _buildInput(
            controller: _newPasswordController,
            hint: '••••••••',
            icon: Icons.lock_outline_rounded,
            obscureText: true,
            isDark: isDark,
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12)),
          ],
          const SizedBox(height: 20),
          GestureDetector(
            onTap: _loading ? null : _handleResetPassword,
            child: Container(
              height: 48,
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: AppColors.flameGradient,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(
                child: _loading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A)))
                    : const Text(
                        'Update Password',
                        style: TextStyle(color: Color(0xFF0F172A), fontSize: 15, fontWeight: FontWeight.w900),
                      ),
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        Center(
          child: GestureDetector(
            onTap: () {
              if (widget.onSwitchToSignIn != null) {
                widget.onSwitchToSignIn!();
              } else {
                context.go('/signin');
              }
            },
            child: Text(
              'Back to Sign In',
              style: const TextStyle(color: AppColors.brandOrange, fontSize: 12.5, fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInput({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscureText = false,
    TextInputType? keyboardType,
    required bool isDark,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF07111F) : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.10) : Colors.black.withValues(alpha: 0.10),
        ),
      ),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        keyboardType: keyboardType,
        style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w500),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: context.textDim, fontSize: 13.5),
          prefixIcon: Icon(icon, color: context.textDim, size: 18),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        ),
      ),
    );
  }
}
