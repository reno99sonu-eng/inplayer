import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
            onTap: () {
              // TODO: Navigate to edit profile
            },
          ),
          _buildMenuItem(
            icon: Icons.lock,
            title: 'Change Password',
            onTap: () {
              // TODO: Navigate to change password
            },
          ),
          _buildMenuItem(
            icon: Icons.email,
            title: 'Email Settings',
            onTap: () {
              // TODO: Navigate to email settings
            },
          ),
          const Divider(height: 1, color: AppColors.cardDark),
          _buildSectionHeader('Preferences'),
          _buildSwitchItem(
            icon: Icons.notifications,
            title: 'Push Notifications',
            value: true,
            onChanged: (value) {
              // TODO: Handle notification toggle
            },
          ),
          _buildSwitchItem(
            icon: Icons.dark_mode,
            title: 'Dark Mode',
            value: true,
            onChanged: (value) {
              // TODO: Handle dark mode toggle
            },
          ),
          _buildMenuItem(
            icon: Icons.hd,
            title: 'Video Quality',
            onTap: () {
              // TODO: Navigate to video quality settings
            },
            trailing: const Text('Auto'),
          ),
          _buildMenuItem(
            icon: Icons.download,
            title: 'Download Quality',
            onTap: () {
              // TODO: Navigate to download quality settings
            },
            trailing: const Text('Medium'),
          ),
          const Divider(height: 1, color: AppColors.cardDark),
          _buildSectionHeader('Privacy'),
          _buildMenuItem(
            icon: Icons.visibility,
            title: 'Privacy Settings',
            onTap: () {
              // TODO: Navigate to privacy settings
            },
          ),
          _buildMenuItem(
            icon: Icons.block,
            title: 'Blocked Users',
            onTap: () {
              // TODO: Navigate to blocked users
            },
          ),
          const Divider(height: 1, color: AppColors.cardDark),
          _buildSectionHeader('Support'),
          _buildMenuItem(
            icon: Icons.help,
            title: 'Help & Support',
            onTap: () {
              // TODO: Navigate to help
            },
          ),
          _buildMenuItem(
            icon: Icons.info,
            title: 'About',
            onTap: () {
              // TODO: Navigate to about
            },
          ),
          _buildMenuItem(
            icon: Icons.description,
            title: 'Terms of Service',
            onTap: () {
              // TODO: Navigate to terms
            },
          ),
          _buildMenuItem(
            icon: Icons.privacy_tip,
            title: 'Privacy Policy',
            onTap: () {
              // TODO: Navigate to privacy policy
            },
          ),
          const Divider(height: 1, color: AppColors.cardDark),
          _buildSectionHeader('Danger Zone'),
          _buildMenuItem(
            icon: Icons.delete_forever,
            title: 'Delete Account',
            onTap: () {
              _showDeleteAccountDialog(context, ref);
            },
            isDestructive: true,
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
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return SwitchListTile(
      secondary: Icon(icon, color: AppColors.textPrimaryDark),
      title: Text(
        title,
        style: const TextStyle(color: AppColors.textPrimaryDark),
      ),
      value: value,
      onChanged: onChanged,
    );
  }

  void _showDeleteAccountDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Account'),
        content: const Text(
          'Are you sure you want to delete your account? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              // TODO: Implement account deletion
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
