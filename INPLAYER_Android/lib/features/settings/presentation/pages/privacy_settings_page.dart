import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../providers/auth_provider.dart';
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
        const SnackBar(
          content: Text("Couldn't update your privacy setting."),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text('Privacy Settings',
            style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Who can view your full channel profile',
            style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 13),
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
                        : AppColors.cardDark,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: selected
                          ? AppColors.brandOrange
                          : Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(opt.icon,
                          color: selected
                              ? AppColors.brandOrange
                              : AppColors.textSecondaryDark),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(opt.title,
                                style: const TextStyle(
                                    color: AppColors.textPrimaryDark,
                                    fontWeight: FontWeight.w700)),
                            const SizedBox(height: 2),
                            Text(opt.subtitle,
                                style: const TextStyle(
                                    color: AppColors.textSecondaryDark, fontSize: 12)),
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
        ],
      ),
    );
  }
}
