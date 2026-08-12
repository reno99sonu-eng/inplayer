import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/admin_service.dart';
import '../widgets/admin_common.dart';

/// Broadcast composer (POST /api/admin/notifications) — sends a real
/// notification to one user by username, or to every InPlayer user.
/// Mirrors app/api/admin/notifications/route.ts.
class AdminNotificationsTab extends ConsumerStatefulWidget {
  const AdminNotificationsTab({super.key});

  @override
  ConsumerState<AdminNotificationsTab> createState() => _AdminNotificationsTabState();
}

class _AdminNotificationsTabState extends ConsumerState<AdminNotificationsTab> {
  String _target = 'user';
  final _usernameController = TextEditingController();
  final _messageController = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final message = _messageController.text.trim();
    if (message.isEmpty) {
      showAdminSnack(context, 'Write a message first.');
      return;
    }
    if (_target == 'user' && _usernameController.text.trim().isEmpty) {
      showAdminSnack(context, 'Enter a username.');
      return;
    }

    if (_target == 'all') {
      final confirmed = await confirmAdminDialog(
        context,
        title: 'Send to everyone?',
        content: 'This notifies every InPlayer user. This can\'t be undone.',
        confirmLabel: 'Send to all',
        destructive: false,
      );
      if (!confirmed) return;
    }

    setState(() => _sending = true);
    final result = await ref.read(adminServiceProvider).sendBroadcast(
          target: _target,
          message: message,
          username: _target == 'user' ? _usernameController.text.trim() : null,
        );
    if (!mounted) return;
    setState(() => _sending = false);
    if (result.success) {
      showAdminSnack(context, 'Sent to ${result.sentCount} ${result.sentCount == 1 ? 'user' : 'users'}.');
      _messageController.clear();
      _usernameController.clear();
    } else {
      showAdminSnack(context, result.error ?? "Couldn't send that.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Send to', style: TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Row(
          children: [
            ChoiceChip(
              label: const Text('One user'),
              selected: _target == 'user',
              onSelected: (_) => setState(() => _target = 'user'),
              backgroundColor: AppColors.cardDark,
              selectedColor: AppColors.brandOrange.withValues(alpha: 0.25),
              labelStyle: TextStyle(color: _target == 'user' ? AppColors.brandOrange : AppColors.textSecondaryDark),
              side: BorderSide.none,
            ),
            const SizedBox(width: 8),
            ChoiceChip(
              label: const Text('Everyone'),
              selected: _target == 'all',
              onSelected: (_) => setState(() => _target = 'all'),
              backgroundColor: AppColors.cardDark,
              selectedColor: AppColors.brandOrange.withValues(alpha: 0.25),
              labelStyle: TextStyle(color: _target == 'all' ? AppColors.brandOrange : AppColors.textSecondaryDark),
              side: BorderSide.none,
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (_target == 'user') ...[
          TextField(
            controller: _usernameController,
            style: const TextStyle(color: AppColors.textPrimaryDark),
            decoration: const InputDecoration(labelText: 'Username', labelStyle: TextStyle(color: AppColors.textSecondaryDark)),
          ),
          const SizedBox(height: 12),
        ],
        TextField(
          controller: _messageController,
          maxLines: 4,
          maxLength: 500,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: const InputDecoration(labelText: 'Message', labelStyle: TextStyle(color: AppColors.textSecondaryDark)),
        ),
        const SizedBox(height: 8),
        ElevatedButton(
          onPressed: _sending ? null : _send,
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandOrange, minimumSize: const Size.fromHeight(48)),
          child: _sending
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text(_target == 'all' ? 'Send to everyone' : 'Send'),
        ),
      ],
    );
  }
}
