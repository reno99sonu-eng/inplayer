import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
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
    await ref.read(authStateProvider.notifier).refreshUser();
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
      SnackBar(
        content: Text(message),
        backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      ),
    );
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
          title: Text(
            'Creator Studio',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: context.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
        ),
        body: RefreshIndicator(
          color: AppColors.brandOrange,
          backgroundColor: context.bgCard,
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              _buildDashboardSummary(),
              const SizedBox(height: 16),
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
              const SizedBox(height: 8),
              Divider(height: 1, color: context.borderSubtle),
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
                trailing: Text('Soon', style: TextStyle(color: context.textDim, fontSize: 12)),
              ),
              const SizedBox(height: 8),
              Divider(height: 1, color: context.borderSubtle),
              _buildSectionHeader('Analytics'),
              _buildMenuItem(
                icon: Icons.bar_chart,
                title: 'View Analytics',
                onTap: () => _showSnack('Coming soon.'),
                trailing: Text('Soon', style: TextStyle(color: context.textDim, fontSize: 12)),
              ),
              _buildMenuItem(
                icon: Icons.trending_up,
                title: 'Revenue',
                onTap: () => _showSnack('Coming soon.'),
                trailing: Text('Soon', style: TextStyle(color: context.textDim, fontSize: 12)),
              ),
              const SizedBox(height: 8),
              Divider(height: 1, color: context.borderSubtle),
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
      ),
    );
  }

  Widget _buildDashboardSummary() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: (context.isDark ? Colors.black : const Color(0xFFE2E8F0)).withValues(alpha: 0.12),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.brandOrange.withValues(alpha: 0.12),
              border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.35)),
            ),
            child: const Icon(Icons.auto_awesome_rounded, color: AppColors.brandOrange),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your creator hub',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: context.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  'Upload, track reach, and manage your content in one place.',
                  style: TextStyle(fontSize: 12, color: context.textSecondary),
                ),
              ],
            ),
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
    required VoidCallback? onTap,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.borderSubtle),
      ),
      child: ListTile(
        leading: Icon(icon, color: AppColors.brandOrange),
        title: Text(
          title,
          style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.w600),
        ),
        trailing: Text(
          value,
          style: TextStyle(
            color: context.textPrimary,
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
      leading: Icon(icon, color: context.textPrimary),
      title: Text(
        title,
        style: TextStyle(color: context.textPrimary),
      ),
      trailing: trailing ??
          Icon(Icons.chevron_right, color: context.textDim),
      onTap: onTap,
    );
  }
}
