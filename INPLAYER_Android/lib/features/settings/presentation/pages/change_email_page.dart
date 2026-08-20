import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/auth_service.dart';

class ChangeEmailPage extends ConsumerStatefulWidget {
  const ChangeEmailPage({super.key});

  @override
  ConsumerState<ChangeEmailPage> createState() => _ChangeEmailPageState();
}

class _ChangeEmailPageState extends ConsumerState<ChangeEmailPage> {
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  bool _saving = false;
  bool _awaitingCode = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _requestChange() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter a valid email address.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final result = await ref.read(authServiceProvider).requestEmailChange(email);

    if (!mounted) return;
    setState(() => _saving = false);

    if (!result.success) {
      setState(() => _error = result.error ?? "Couldn't update your email.");
      return;
    }

    if (result.needsConfirmation) {
      setState(() => _awaitingCode = true);
    } else {
      _onEmailConfirmed();
    }
  }

  Future<void> _confirmCode() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) {
      setState(() => _error = 'Enter the verification code we sent you.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final result = await ref.read(authServiceProvider).confirmEmailChange(code);

    if (!mounted) return;
    setState(() => _saving = false);

    if (result.success) {
      _onEmailConfirmed();
    } else {
      setState(() => _error = result.error ?? "That code didn't work.");
    }
  }

  void _onEmailConfirmed() {
    final newEmail = _emailController.text.trim();
    ref.read(authStateProvider.notifier).updateLocalUser((u) => u.copyWith(email: newEmail));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Email updated.'),
        backgroundColor: AppColors.surfaceDark,
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text('Email Settings',
            style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (!_awaitingCode) ...[
            const Text('New email address',
                style: TextStyle(
                    color: AppColors.textSecondaryDark,
                    fontSize: 12,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              style: const TextStyle(color: AppColors.textPrimaryDark),
              decoration: _fieldDecoration('you@example.com'),
            ),
          ] else ...[
            Text(
              'We sent a verification code to ${_emailController.text.trim()}. Enter it below to confirm the change.',
              style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 13),
            ),
            const SizedBox(height: 16),
            const Text('Verification code',
                style: TextStyle(
                    color: AppColors.textSecondaryDark,
                    fontSize: 12,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            TextField(
              controller: _codeController,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: AppColors.textPrimaryDark),
              decoration: _fieldDecoration('123456'),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
          ],
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _saving ? null : (_awaitingCode ? _confirmCode : _requestChange),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brandOrange,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)))
                  : Text(_awaitingCode ? 'Confirm' : 'Send Verification Code',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _fieldDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: AppColors.textSecondaryDark),
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.05),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }
}
