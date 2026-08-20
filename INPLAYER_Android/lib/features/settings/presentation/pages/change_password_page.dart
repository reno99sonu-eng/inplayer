import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/auth_service.dart';

class ChangePasswordPage extends ConsumerStatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  ConsumerState<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends ConsumerState<ChangePasswordPage> {
  final _oldController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _oldController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final oldPassword = _oldController.text;
    final newPassword = _newController.text;
    final confirm = _confirmController.text;

    if (oldPassword.isEmpty || newPassword.isEmpty) {
      setState(() => _error = 'Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setState(() => _error = 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword != confirm) {
      setState(() => _error = "New passwords don't match.");
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final result = await ref.read(authServiceProvider).changePassword(
          oldPassword: oldPassword,
          newPassword: newPassword,
        );

    if (!mounted) return;
    setState(() => _saving = false);

    if (result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password changed.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
      Navigator.of(context).pop();
    } else {
      setState(() => _error = result.error ?? "Couldn't change your password.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text('Change Password',
            style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _passwordField(_oldController, 'Current password'),
          const SizedBox(height: 12),
          _passwordField(_newController, 'New password'),
          const SizedBox(height: 12),
          _passwordField(_confirmController, 'Confirm new password'),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
          ],
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _saving ? null : _submit,
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
                  : const Text('Update Password',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _passwordField(TextEditingController controller, String hint) {
    return TextField(
      controller: controller,
      obscureText: true,
      style: const TextStyle(color: AppColors.textPrimaryDark),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.textSecondaryDark),
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.05),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }
}
