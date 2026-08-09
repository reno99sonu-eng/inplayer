import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';

class CreatorStudioPage extends StatelessWidget {
  const CreatorStudioPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        title: const Text(
          'Creator Studio',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
      ),
      body: ListView(
        children: [
          _buildSectionHeader('Dashboard'),
          _buildStatCard(
            icon: Icons.play_circle,
            title: 'Total Views',
            value: '0',
            onTap: () {},
          ),
          _buildStatCard(
            icon: Icons.subscriptions,
            title: 'Subscribers',
            value: '0',
            onTap: () {},
          ),
          _buildStatCard(
            icon: Icons.video_library,
            title: 'Videos',
            value: '0',
            onTap: () {},
          ),
          const Divider(height: 1, color: AppColors.cardDark),
          _buildSectionHeader('Content'),
          _buildMenuItem(
            icon: Icons.upload,
            title: 'Upload Video',
            onTap: () => context.push('/upload'),
          ),
          _buildMenuItem(
            icon: Icons.edit,
            title: 'Manage Videos',
            onTap: () {
              // TODO: Navigate to video management
            },
          ),
          _buildMenuItem(
            icon: Icons.comment,
            title: 'Comments',
            onTap: () {
              // TODO: Navigate to comments
            },
          ),
          const Divider(height: 1, color: AppColors.cardDark),
          _buildSectionHeader('Analytics'),
          _buildMenuItem(
            icon: Icons.bar_chart,
            title: 'View Analytics',
            onTap: () {
              // TODO: Navigate to analytics
            },
          ),
          _buildMenuItem(
            icon: Icons.trending_up,
            title: 'Revenue',
            onTap: () {
              // TODO: Navigate to revenue
            },
          ),
          const Divider(height: 1, color: AppColors.cardDark),
          _buildSectionHeader('Settings'),
          _buildMenuItem(
            icon: Icons.settings,
            title: 'Channel Settings',
            onTap: () {
              // TODO: Navigate to channel settings
            },
          ),
          _buildMenuItem(
            icon: Icons.admin_panel_settings,
            title: 'Admin Panel',
            onTap: () {
              // TODO: Navigate to admin panel
            },
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

  Widget _buildStatCard({
    required IconData icon,
    required String title,
    required String value,
    required VoidCallback onTap,
  }) {
    return Card(
      color: AppColors.cardDark,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: Icon(icon, color: AppColors.brandOrange),
        title: Text(
          title,
          style: const TextStyle(color: AppColors.textPrimaryDark),
        ),
        trailing: Text(
          value,
          style: const TextStyle(
            color: AppColors.textPrimaryDark,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        onTap: onTap,
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textPrimaryDark),
      title: Text(
        title,
        style: const TextStyle(color: AppColors.textPrimaryDark),
      ),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondaryDark),
      onTap: onTap,
    );
  }
}