import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/about_app_dialog.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../providers/theme_provider.dart';
import '../../../../services/auth_service.dart';
import '../../../../services/settings_service.dart';

const _pushNotificationsPrefKey = 'push_notifications_enabled';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  bool _pushNotifications = true;
  bool _prefsLoaded = false;
  bool _deletingAccount = false;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _pushNotifications = prefs.getBool(_pushNotificationsPrefKey) ?? true;
      _prefsLoaded = true;
    });
  }

  Future<void> _setPushNotifications(bool value) async {
    setState(() => _pushNotifications = value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_pushNotificationsPrefKey, value);
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      ),
    );
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && mounted) {
      _showSnack("Couldn't open that page.");
    }
  }

  Future<void> _showThemePicker() async {
    final currentChoice = ref.read(themeChoiceProvider);

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: ctx.bgModal,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: ctx.borderSubtle),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: ctx.textDim.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Choose Appearance',
                style: TextStyle(
                  color: ctx.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              ...ThemeChoice.values.map((choice) {
                final isSelected = choice == currentChoice;
                return InkWell(
                  onTap: () {
                    ref.read(themeChoiceProvider.notifier).setTheme(choice);
                    Navigator.pop(ctx);
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.brandOrange.withValues(alpha: 0.12)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected
                            ? AppColors.brandOrange.withValues(alpha: 0.4)
                            : Colors.transparent,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          choice == ThemeChoice.system
                              ? Icons.brightness_auto
                              : choice == ThemeChoice.light
                                  ? Icons.light_mode
                                  : Icons.dark_mode,
                          color: isSelected ? AppColors.brandOrange : ctx.textSecondary,
                          size: 22,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                choice.label,
                                style: TextStyle(
                                  color: isSelected ? AppColors.brandOrange : ctx.textPrimary,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                  fontSize: 15,
                                ),
                              ),
                              if (choice == ThemeChoice.system)
                                Text(
                                  'Light from 6 AM to 6 PM, Dark at night',
                                  style: TextStyle(
                                    color: ctx.textDim,
                                    fontSize: 12,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (isSelected)
                          const Icon(Icons.check_circle, color: AppColors.brandOrange, size: 20),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showAbout() => showInPlayerAboutDialog(context);

  Future<void> _confirmDeleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: ctx.bgModal,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: ctx.borderSubtle),
        ),
        title: Text('Delete Account', style: TextStyle(color: ctx.textPrimary, fontWeight: FontWeight.bold)),
        content: Text(
          'This permanently deletes your videos, profile, and username reservation, and '
          "signs you out for good. This can't be undone. Are you sure?",
          style: TextStyle(color: ctx.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Cancel', style: TextStyle(color: ctx.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed != true || _deletingAccount) return;

    setState(() => _deletingAccount = true);

    final dataResult = await ref.read(settingsServiceProvider).deleteAccountData();

    if (!dataResult.success) {
      if (!mounted) return;
      setState(() => _deletingAccount = false);
      _showSnack("Couldn't delete your account right now. Please try again.");
      return;
    }

    final authResult = await ref.read(authServiceProvider).deleteUser();

    if (!mounted) return;
    setState(() => _deletingAccount = false);

    if (authResult.success) {
      ref.read(authStateProvider.notifier).setUnauthenticated();
    } else {
      _showSnack(authResult.error ?? "Your data was deleted, but signing you out failed.");
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentTheme = ref.watch(themeChoiceProvider);

    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        title: Text(
          'Settings',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: context.textPrimary,
            fontSize: 20,
          ),
        ),
      ),
      body: ListView(
        children: [
          // 1. APPEARANCE
          _buildSectionHeader('Appearance'),
          _buildMenuItem(
            icon: currentTheme == ThemeChoice.system
                ? Icons.brightness_auto
                : currentTheme == ThemeChoice.light
                    ? Icons.light_mode
                    : Icons.dark_mode,
            title: 'Theme & Appearance',
            trailing: Text(
              currentTheme.label,
              style: const TextStyle(
                color: AppColors.brandOrange,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
            onTap: _showThemePicker,
          ),
          Divider(height: 1, color: context.borderSubtle),

          // 2. GENERAL
          _buildSectionHeader('General'),
          _buildMenuItem(
            icon: Icons.person_outline,
            title: 'Edit Profile & Avatar',
            onTap: () => context.push('/settings/edit-profile'),
          ),
          _buildMenuItem(
            icon: Icons.lock_outline,
            title: 'Change Password',
            onTap: () => context.push('/settings/change-password'),
          ),
          _buildMenuItem(
            icon: Icons.mail_outline,
            title: 'Email Address',
            onTap: () => context.push('/settings/change-email'),
          ),
          _buildSwitchItem(
            icon: Icons.notifications_outlined,
            title: 'Push Notifications',
            value: _pushNotifications,
            onChanged: _prefsLoaded ? _setPushNotifications : null,
          ),
          _buildMenuItem(
            icon: Icons.shield_outlined,
            title: 'Content Access (18+ / Kids Mode)',
            onTap: () => context.push('/settings/content-access'),
          ),
          _buildMenuItem(
            icon: Icons.language_outlined,
            title: 'Language',
            trailing: Text('English', style: TextStyle(color: context.textDim, fontSize: 13)),
            onTap: () => _showSnack('InPlayer is currently available in English only.'),
          ),
          Divider(height: 1, color: context.borderSubtle),

          // 3. PLAYBACK
          _buildSectionHeader('Playback'),
          _buildMenuItem(
            icon: Icons.play_circle_outline,
            title: 'Streaming & Quality Preferences',
            onTap: () => context.push('/settings/playback'),
          ),
          _buildMenuItem(
            icon: Icons.download_for_offline_outlined,
            title: 'Downloads & Offline Videos',
            onTap: () => context.push('/downloads'),
          ),
          Divider(height: 1, color: context.borderSubtle),

          // 4. PRIVACY
          _buildSectionHeader('Account & Privacy'),
          _buildMenuItem(
            icon: Icons.visibility_outlined,
            title: 'Privacy, Passkeys & Active Sessions',
            onTap: () => context.push('/settings/privacy'),
          ),
          _buildMenuItem(
            icon: Icons.block_outlined,
            title: 'Blocked Users',
            onTap: () => context.push('/settings/blocked-users'),
          ),
          Divider(height: 1, color: context.borderSubtle),

          // 5. PLANS & PURCHASES
          _buildSectionHeader('Plans & Purchases'),
          _buildMenuItem(
            icon: Icons.workspace_premium_outlined,
            title: 'Premium Plans & Subscriptions',
            onTap: () => context.push('/settings/plans'),
          ),
          Divider(height: 1, color: context.borderSubtle),

          // 6. ANALYTICS
          _buildSectionHeader('User Analytics'),
          _buildMenuItem(
            icon: Icons.insights_outlined,
            title: 'Creator & Upload Analytics',
            onTap: () => context.push('/settings/analytics'),
          ),
          Divider(height: 1, color: context.borderSubtle),

          // 7. STORAGE
          _buildSectionHeader('Storage'),
          _buildMenuItem(
            icon: Icons.storage_outlined,
            title: 'Cloud Storage & Uploads Overview',
            onTap: () => context.push('/settings/storage'),
          ),
          Divider(height: 1, color: context.borderSubtle),

          // 8. ABOUT & LEGAL
          _buildSectionHeader('About & Legal'),
          _buildMenuItem(
            icon: Icons.info_outline,
            title: 'About InPlayer',
            onTap: _showAbout,
          ),
          _buildMenuItem(
            icon: Icons.bug_report_outlined,
            title: 'Report a Problem',
            onTap: () => context.push('/settings/report-problem'),
          ),
          _buildMenuItem(
            icon: Icons.help_outline,
            title: 'Help Center',
            onTap: () => context.push('/settings/help'),
          ),
          _buildMenuItem(
            icon: Icons.email_outlined,
            title: 'Contact Support',
            onTap: () => context.push('/contact'),
          ),
          _buildMenuItem(
            icon: Icons.description_outlined,
            title: 'Terms of Service',
            onTap: () => context.push('/settings/terms'),
          ),
          _buildMenuItem(
            icon: Icons.storefront_outlined,
            title: 'HamMart Vendor Terms',
            onTap: () => context.push('/settings/vendor-terms'),
          ),
          _buildMenuItem(
            icon: Icons.privacy_tip_outlined,
            title: 'Privacy Policy',
            onTap: () => context.push('/settings/privacy-policy'),
          ),
          Divider(height: 1, color: context.borderSubtle),

          // DANGER ZONE
          _buildSectionHeader('Danger Zone'),
          _buildMenuItem(
            icon: Icons.delete_forever_outlined,
            title: _deletingAccount ? 'Deleting your account...' : 'Delete Account',
            onTap: _deletingAccount ? () {} : _confirmDeleteAccount,
            isDestructive: true,
            trailing: _deletingAccount
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.error),
                  )
                : null,
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          color: AppColors.brandOrange,
          fontWeight: FontWeight.w800,
          fontSize: 11,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Widget? trailing,
    bool isDestructive = false,
  }) {
    return ListTile(
      leading: Icon(
        icon,
        color: isDestructive ? AppColors.error : context.textPrimary,
        size: 22,
      ),
      title: Text(
        title,
        style: TextStyle(
          color: isDestructive ? AppColors.error : context.textPrimary,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
      trailing: trailing ?? Icon(Icons.chevron_right, color: context.textDim, size: 20),
      onTap: onTap,
    );
  }

  Widget _buildSwitchItem({
    required IconData icon,
    required String title,
    String? subtitle,
    required bool value,
    required ValueChanged<bool>? onChanged,
  }) {
    return SwitchListTile(
      secondary: Icon(icon, color: context.textPrimary, size: 22),
      title: Text(
        title,
        style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w500),
      ),
      subtitle: subtitle != null
          ? Text(subtitle, style: TextStyle(color: context.textSecondary, fontSize: 12))
          : null,
      activeThumbColor: AppColors.brandOrange,
      value: value,
      onChanged: onChanged,
    );
  }
}
