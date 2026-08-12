import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/video_service.dart';
import '../../../../services/channel_service.dart';

class CreatorStudioPage extends ConsumerStatefulWidget {
  const CreatorStudioPage({super.key});

  @override
  ConsumerState<CreatorStudioPage> createState() => _CreatorStudioPageState();
}

class _CreatorStudioPageState extends ConsumerState<CreatorStudioPage> {
  bool _loading = true;
  int _videoCount = 0;
  int _totalViews = 0;
  int _subscriberCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    final userId = authState.user.userId;

    setState(() => _loading = true);

    final results = await Future.wait([
      ref.read(videoServiceProvider).getMyVideos(),
      ref.read(channelServiceProvider).getSubscriptionStatus(userId),
    ]);

    if (!mounted) return;

    final videos = results[0] as List;
    final subStatus = results[1] as Map<String, dynamic>?;

    setState(() {
      _videoCount = videos.length;
      _totalViews =
          videos.fold<int>(0, (sum, v) => sum + _parseViews((v as dynamic).views as String));
      _subscriberCount = (subStatus?['subscriberCount'] as num?)?.toInt() ?? 0;
      _loading = false;
    });
  }

  /// Video.views is already formatted (e.g. "1,204 views") rather than a
  /// raw int, so the dashboard total is summed by stripping non-digits.
  int _parseViews(String formatted) {
    final digits = formatted.replaceAll(RegExp(r'[^0-9]'), '');
    return int.tryParse(digits) ?? 0;
  }

  String _formatCount(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return '$n';
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.surfaceDark),
    );
  }

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
      body: RefreshIndicator(
        color: AppColors.brandOrange,
        backgroundColor: AppColors.surfaceDark,
        onRefresh: _load,
        child: ListView(
          children: [
            _buildSectionHeader('Dashboard'),
            _buildStatCard(
              icon: Icons.play_circle,
              title: 'Total Views',
              value: _loading ? '—' : _formatCount(_totalViews),
              onTap: () => context.push('/my-videos'),
            ),
            _buildStatCard(
              icon: Icons.subscriptions,
              title: 'Subscribers',
              value: _loading ? '—' : _formatCount(_subscriberCount),
              onTap: null,
            ),
            _buildStatCard(
              icon: Icons.video_library,
              title: 'Videos',
              value: _loading ? '—' : '$_videoCount',
              onTap: () => context.push('/my-videos'),
            ),
            const Divider(height: 1, color: AppColors.cardDark),
            _buildSectionHeader('Content'),
            _buildMenuItem(
              icon: Icons.upload,
              title: 'Upload Video',
              onTap: () => context.push('/upload'),
            ),
            _buildMenuItem(
              icon: Icons.podcasts,
              title: 'Go Live',
              onTap: () => context.push('/live'),
            ),
            _buildMenuItem(
              icon: Icons.edit,
              title: 'Manage Videos',
              onTap: () => context.push('/my-videos'),
            ),
            _buildMenuItem(
              icon: Icons.comment,
              title: 'Comments',
              onTap: () => _showSnack('Coming soon.'),
              trailing: const Text('Coming soon',
                  style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
            ),
            const Divider(height: 1, color: AppColors.cardDark),
            _buildSectionHeader('Analytics'),
            _buildMenuItem(
              icon: Icons.bar_chart,
              title: 'View Analytics',
              onTap: () => _showSnack('Coming soon.'),
              trailing: const Text('Coming soon',
                  style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
            ),
            _buildMenuItem(
              icon: Icons.trending_up,
              title: 'Revenue',
              onTap: () => _showSnack('Coming soon.'),
              trailing: const Text('Coming soon',
                  style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
            ),
            const Divider(height: 1, color: AppColors.cardDark),
            _buildSectionHeader('Settings'),
            _buildMenuItem(
              icon: Icons.settings,
              title: 'Channel Settings',
              onTap: () => context.push('/settings/edit-profile'),
            ),
            _buildMenuItem(
              icon: Icons.admin_panel_settings,
              title: 'Admin Panel',
              onTap: () => context.push('/admin'),
            ),
          ],
        ),
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
    required VoidCallback? onTap,
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
    Widget? trailing,
  }) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textPrimaryDark),
      title: Text(
        title,
        style: const TextStyle(color: AppColors.textPrimaryDark),
      ),
      trailing: trailing ??
          const Icon(Icons.chevron_right, color: AppColors.textSecondaryDark),
      onTap: onTap,
    );
  }
}
