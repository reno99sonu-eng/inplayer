import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../providers/auth_provider.dart';
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
  bool _audience18Plus = true;
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
      _audience18Plus = prefs.getString('audience') != 'kids';
      _prefsLoaded = true;
    });
  }

  Future<void> _setPushNotifications(bool value) async {
    setState(() => _pushNotifications = value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_pushNotificationsPrefKey, value);
  }

  Future<void> _setAudience18Plus(bool value) async {
    setState(() => _audience18Plus = value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('audience', value ? '18+' : 'kids');
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.surfaceDark),
    );
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && mounted) {
      _showSnack("Couldn't open that page.");
    }
  }

  Future<void> _showAbout() async {
    final info = await PackageInfo.fromPlatform();
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Text('InPlayer', style: TextStyle(color: AppColors.textPrimaryDark)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Version ${info.version} (build ${info.buildNumber})',
                style: const TextStyle(color: AppColors.textSecondaryDark)),
            const SizedBox(height: 8),
            const Text(
              'The InPlayer Android app — a companion to inplayer.in.',
              style: TextStyle(color: AppColors.textSecondaryDark),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close', style: TextStyle(color: AppColors.brandOrange)),
          ),
        ],
      ),
    );
  }

  void _showVideoQualityInfo() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Text('Video Quality', style: TextStyle(color: AppColors.textPrimaryDark)),
        content: const Text(
          "InPlayer streams video with adaptive bitrate — playback quality adjusts "
          "automatically to your connection speed. There's no manual quality picker yet.",
          style: TextStyle(color: AppColors.textSecondaryDark),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Got it', style: TextStyle(color: AppColors.brandOrange)),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDeleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Text('Delete Account', style: TextStyle(color: AppColors.textPrimaryDark)),
        content: const Text(
          'This permanently deletes your videos, profile, and username reservation, and '
          "signs you out for good. This can't be undone. Are you sure?",
          style: TextStyle(color: AppColors.textSecondaryDark),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true || _deletingAccount) return;

    setState(() => _deletingAccount = true);

    // Order matters: clean up server-side data (videos, username, profile
    // row) WHILE the session is still valid, then delete the Cognito login
    // itself — see AuthService.deleteUser()'s doc comment. Mirrors the
    // website's own delete-account flow exactly.
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
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        title: const Text(
          'Settings',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
      ),
      body: ListView(
        children: [
          _buildSectionHeader('Account'),
          _buildMenuItem(
            icon: Icons.person,
            title: 'Edit Profile',
            onTap: () => context.push('/settings/edit-profile'),
          ),
          _buildMenuItem(
            icon: Icons.lock,
            title: 'Change Password',
            onTap: () => context.push('/settings/change-password'),
          ),
          _buildMenuItem(
            icon: Icons.email,
            title: 'Email Settings',
            onTap: () => context.push('/settings/change-email'),
          ),
          const Divider(height: 1, color: AppColors.cardDark),
          _buildSectionHeader('Preferences'),
          _buildSwitchItem(
            icon: Icons.notifications,
            title: 'Push Notifications',
            value: _pushNotifications,
            onChanged: _prefsLoaded ? _setPushNotifications : null,
          ),
          _buildSwitchItem(
            icon: Icons.dark_mode,
            title: 'Dark Mode',
            subtitle: 'InPlayer is dark-themed only, for now.',
            value: true,
            onChanged: null,
          ),
          _buildMenuItem(
            icon: Icons.hd,
            title: 'Video Quality',
            onTap: _showVideoQualityInfo,
            trailing: const Text('Auto', style: TextStyle(color: AppColors.textSecondaryDark)),
          ),
          _buildMenuItem(
            icon: Icons.download,
            title: 'Download Quality',
            onTap: () => _showSnack("Downloads aren't available yet."),
            trailing:
                const Text('Coming soon', style: TextStyle(color: AppColors.textSecondaryDark)),
          ),
          const Divider(height: 1, color: AppColors.cardDark),
          _buildSectionHeader('Privacy'),
          _buildSwitchItem(
            icon: Icons.family_restroom,
            title: '18+ Content',
            subtitle: 'Turn off for Kids mode.',
            value: _audience18Plus,
            onChanged: _prefsLoaded ? _setAudience18Plus : null,
          ),
          _buildMenuItem(
            icon: Icons.visibility,
            title: 'Privacy Settings',
            onTap: () => context.push('/settings/privacy'),
          ),
          _buildMenuItem(
            icon: Icons.block,
            title: 'Blocked Users',
            onTap: () => _showSnack('Coming soon.'),
          ),
          const Divider(height: 1, color: AppColors.cardDark),
          _buildSectionHeader('Support'),
          _buildMenuItem(
            icon: Icons.help,
            title: 'Help & Support',
            onTap: () => _openUrl('https://inplayer.in/help'),
          ),
          _buildMenuItem(
            icon: Icons.info,
            title: 'About',
            onTap: _showAbout,
          ),
          _buildMenuItem(
            icon: Icons.description,
            title: 'Terms of Service',
            onTap: () => _openUrl('https://inplayer.in/terms'),
          ),
          _buildMenuItem(
            icon: Icons.privacy_tip,
            title: 'Privacy Policy',
            onTap: () => _openUrl('https://inplayer.in/privacy'),
          ),
          const Divider(height: 1, color: AppColors.cardDark),
          _buildSectionHeader('Danger Zone'),
          _buildMenuItem(
            icon: Icons.delete_forever,
            title: _deletingAccount ? 'Deleting your account...' : 'Delete Account',
            onTap: _deletingAccount ? () {} : _confirmDeleteAccount,
            isDestructive: true,
            trailing: _deletingAccount
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child:
                        CircularProgressIndicator(strokeWidth: 2, color: AppColors.error),
                  )
                : null,
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
      child: Text(
        title,
        style: const TextStyle(
          color: AppColors.brandOrange,
          fontWeight: FontWeight.bold,
          fontSize: 14,
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
        color: isDestructive ? AppColors.error : AppColors.textPrimaryDark,
      ),
      title: Text(
        title,
        style: TextStyle(
          color: isDestructive ? AppColors.error : AppColors.textPrimaryDark,
        ),
      ),
      trailing:
          trailing ??
          const Icon(Icons.chevron_right, color: AppColors.textSecondaryDark),
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
      secondary: Icon(icon, color: AppColors.textPrimaryDark),
      title: Text(
        title,
        style: const TextStyle(color: AppColors.textPrimaryDark),
      ),
      subtitle: subtitle != null
          ? Text(subtitle, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12))
          : null,
      activeColor: AppColors.brandOrange,
      value: value,
      onChanged: onChanged,
    );
  }
}
