import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/biometric_lock_service.dart';
import '../../../../services/settings_service.dart';

class PrivacySettingsPage extends ConsumerStatefulWidget {
  const PrivacySettingsPage({super.key});

  @override
  ConsumerState<PrivacySettingsPage> createState() => _PrivacySettingsPageState();
}

class _PrivacySettingsPageState extends ConsumerState<PrivacySettingsPage> {
  late String _selected;
  bool _saving = false;

  static const _options = [
    (
      value: 'public',
      title: 'Public',
      subtitle: 'Anyone can view your channel and videos.',
      icon: Icons.public,
    ),
    (
      value: 'connections',
      title: 'Connections only',
      subtitle: 'Only people you\'re connected with can view your full profile.',
      icon: Icons.people_outline,
    ),
    (
      value: 'private',
      title: 'Private',
      subtitle: 'Only you can view your full profile.',
      icon: Icons.lock_outline,
    ),
  ];

  @override
  void initState() {
    super.initState();
    final authState = ref.read(authStateProvider);
    _selected =
        authState is AuthStateAuthenticated ? authState.user.usernamePrivacy : 'public';
  }

  Future<void> _select(String value) async {
    if (value == _selected || _saving) return;
    final previous = _selected;
    setState(() {
      _selected = value;
      _saving = true;
    });

    final ok = await ref.read(settingsServiceProvider).updatePrivacy(value);

    if (!mounted) return;
    setState(() => _saving = false);

    if (ok) {
      ref
          .read(authStateProvider.notifier)
          .updateLocalUser((u) => u.copyWith(usernamePrivacy: value));
    } else {
      setState(() => _selected = previous);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text("Couldn't update your privacy setting."),
          backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          title: Text('Privacy Settings',
              style: TextStyle(fontWeight: FontWeight.w800, color: context.textPrimary, letterSpacing: -0.5)),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Who can view your full channel profile',
              style: TextStyle(color: context.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            ..._options.map((opt) {
              final selected = opt.value == _selected;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => _select(opt.value),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: selected
                          ? AppColors.brandOrange.withValues(alpha: 0.1)
                          : context.bgCard,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: selected
                            ? AppColors.brandOrange
                            : context.borderSubtle,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(opt.icon,
                            color: selected
                                ? AppColors.brandOrange
                                : context.textDim),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(opt.title,
                                  style: TextStyle(
                                      color: context.textPrimary,
                                      fontWeight: FontWeight.w700)),
                              const SizedBox(height: 2),
                              Text(opt.subtitle,
                                  style: TextStyle(
                                      color: context.textSecondary, fontSize: 12)),
                            ],
                          ),
                        ),
                        if (selected)
                          const Icon(Icons.check_circle, color: AppColors.brandOrange, size: 20),
                      ],
                    ),
                  ),
                ),
              );
            }),

            const SizedBox(height: 16),
            Divider(color: context.borderSubtle),
            const SizedBox(height: 16),

            Text(
              'App Security & Passkeys',
              style: TextStyle(
                color: AppColors.brandOrange,
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 10),

            Consumer(
              builder: (context, ref, _) {
                final lockState = ref.watch(biometricLockProvider);
                final lockNotifier = ref.read(biometricLockProvider.notifier);

                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: context.bgCard,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: lockState.isEnabled
                          ? AppColors.brandOrange.withValues(alpha: 0.5)
                          : context.borderSubtle,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: lockState.isEnabled
                              ? AppColors.brandOrange.withValues(alpha: 0.15)
                              : context.textPrimary.withValues(alpha: 0.05),
                        ),
                        child: Icon(
                          Icons.fingerprint_rounded,
                          color: lockState.isEnabled ? AppColors.brandOrange : context.textDim,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Passkey & Fingerprint Lock',
                              style: TextStyle(
                                color: context.textPrimary,
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              lockState.isEnabled
                                  ? 'Biometric lock is ACTIVE upon launch'
                                  : 'Require biometric or device passkey to open app',
                              style: TextStyle(
                                color: context.textSecondary,
                                fontSize: 11.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Switch.adaptive(
                        value: lockState.isEnabled,
                        activeColor: AppColors.brandOrange,
                        onChanged: (val) async {
                          final success = await lockNotifier.setEnabled(val);
                          if (!success && mounted && val) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Biometric verification cancelled or unavailable'),
                              ),
                            );
                          }
                        },
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 16),
            Divider(color: context.borderSubtle),
            const SizedBox(height: 16),

            Text(
              'Active Sessions',
              style: TextStyle(
                color: AppColors.brandOrange,
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Devices where you are currently signed in to InPlayer.',
              style: TextStyle(color: context.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 10),

            _SessionsSection(),

            const SizedBox(height: 20),
            Divider(color: context.borderSubtle),
            const SizedBox(height: 16),

            Text(
              'Danger Zone',
              style: const TextStyle(
                color: AppColors.error,
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 10),
            _DeleteAccountRow(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _SessionsSection extends ConsumerStatefulWidget {
  @override
  ConsumerState<_SessionsSection> createState() => _SessionsSectionState();
}

class _SessionsSectionState extends ConsumerState<_SessionsSection> {
  List<Map<String, dynamic>> _sessions = [];
  bool _loading = true;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final list = await ref.read(settingsServiceProvider).getSessions();
    if (mounted) {
      setState(() {
        _sessions = list;
        _loading = false;
      });
    }
  }

  Future<void> _revoke(String sessionId) async {
    setState(() => _busyId = sessionId);
    final ok = await ref.read(settingsServiceProvider).revokeSession(sessionId);
    if (!mounted) return;
    setState(() => _busyId = null);
    if (ok) {
      _load();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session revoked successfully.')),
      );
    }
  }

  Future<void> _logoutAll() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: ctx.bgModal,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Log out of all devices?', style: TextStyle(color: ctx.textPrimary, fontWeight: FontWeight.bold)),
        content: Text("You'll need to sign in again everywhere.", style: TextStyle(color: ctx.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Cancel', style: TextStyle(color: ctx.textSecondary))),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Log out everywhere', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final ok = await ref.read(settingsServiceProvider).logoutAllSessions();
    if (ok && mounted) {
      ref.read(authStateProvider.notifier).setUnauthenticated();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Container(
        padding: const EdgeInsets.all(20),
        alignment: Alignment.center,
        child: const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandOrange)),
      );
    }

    if (_sessions.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: context.bgCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: context.borderSubtle),
        ),
        child: Row(
          children: [
            const Icon(Icons.check_circle_outline, color: Color(0xFF10B981), size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Current device is active and secure.',
                style: TextStyle(color: context.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        ..._sessions.map((s) {
          final sId = s['sessionId']?.toString() ?? '';
          final device = s['device']?.toString() ?? 'Mobile Device';
          final location = s['location']?.toString() ?? 'India';
          final isBusy = _busyId == sId;

          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: context.bgCard,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: context.borderSubtle),
            ),
            child: Row(
              children: [
                Icon(Icons.devices_outlined, color: AppColors.brandOrange, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(device, style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(height: 2),
                      Text(location, style: TextStyle(color: context.textDim, fontSize: 11)),
                    ],
                  ),
                ),
                if (isBusy)
                  const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandOrange))
                else
                  TextButton(
                    onPressed: () => _revoke(sId),
                    child: const Text('Revoke', style: TextStyle(color: AppColors.error, fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
              ],
            ),
          );
        }),
        const SizedBox(height: 6),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: AppColors.error.withValues(alpha: 0.4)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(vertical: 10),
            ),
            onPressed: _logoutAll,
            icon: const Icon(Icons.logout, size: 16, color: AppColors.error),
            label: const Text('Log out of all devices', style: TextStyle(color: AppColors.error, fontWeight: FontWeight.bold, fontSize: 12)),
          ),
        ),
      ],
    );
  }
}

class _DeleteAccountRow extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 20),
              const SizedBox(width: 8),
              Text(
                'Delete Account',
                style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Permanently delete your channel, uploaded videos, subscriptions, and profile data.',
            style: TextStyle(color: context.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 12),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            ),
            onPressed: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  backgroundColor: ctx.bgModal,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  title: Text('Permanently Delete Account?', style: TextStyle(color: ctx.textPrimary, fontWeight: FontWeight.bold)),
                  content: Text(
                    "This action cannot be undone. All your uploaded content, playlists, and settings will be permanently erased.",
                    style: TextStyle(color: ctx.textSecondary),
                  ),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Cancel', style: TextStyle(color: ctx.textSecondary))),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      style: TextButton.styleFrom(foregroundColor: AppColors.error),
                      child: const Text('Delete for good', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              );

              if (confirm == true) {
                final dataResult = await ref.read(settingsServiceProvider).deleteAccountData();
                if (dataResult.success) {
                  await ref.read(authServiceProvider).deleteUser();
                  ref.read(authStateProvider.notifier).setUnauthenticated();
                }
              }
            },
            child: const Text('Delete Account', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
