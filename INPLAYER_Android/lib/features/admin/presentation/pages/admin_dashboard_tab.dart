import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:async';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/admin_dashboard_stats.dart';

class AdminDashboardTab extends ConsumerStatefulWidget {
  const AdminDashboardTab({super.key});

  @override
  ConsumerState<AdminDashboardTab> createState() => _AdminDashboardTabState();
}

class _AdminDashboardTabState extends ConsumerState<AdminDashboardTab> {
  bool _loading = true;
  AdminDashboardStats? _stats;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _load(background: true));
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool background = false}) async {
    if (!background && mounted) setState(() => _loading = true);
    final stats = await ref.read(adminServiceProvider).getDashboardStats();
    if (!mounted) return;
    setState(() {
      _stats = stats;
      _loading = false;
    });
  }

  String _formatCount(int n) {
    final digits = n.toString();
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
      buffer.write(digits[i]);
    }
    return buffer.toString();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.brandOrange));
    }

    final stats = _stats;
    if (stats == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.error, size: 48),
            const SizedBox(height: 12),
            Text('Failed to load dashboard stats', style: TextStyle(color: context.textSecondary)),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }

    final cards = [
      (icon: Icons.people, label: 'Total Users', value: _formatCount(stats.totalUsers)),
      (icon: Icons.movie_outlined, label: 'Videos', value: _formatCount(stats.totalVideos)),
      (icon: Icons.play_circle_outline, label: 'Shorts', value: _formatCount(stats.totalShorts)),
      (icon: Icons.library_music_outlined, label: 'Music Tracks', value: _formatCount(stats.totalMusic)),
      (icon: Icons.visibility_outlined, label: 'Total Views', value: _formatCount(stats.totalViews)),
      (icon: Icons.flag_outlined, label: 'Pending Reports', value: stats.reportsTableMissing ? '—' : _formatCount(stats.pendingReports)),
      (icon: Icons.hourglass_top, label: 'Processing', value: _formatCount(stats.processingCount)),
    ];

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: context.bgCard,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.5,
            children: cards.map((c) => _StatCard(icon: c.icon, label: c.label, value: c.value)).toList(),
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: context.bgCard,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: context.borderSubtle),
            ),
            child: ListTile(
              leading: Icon(
                Icons.flag_outlined,
                color: stats.reportsTableMissing ? context.textDim : AppColors.brandOrange,
              ),
              title: Text(
                stats.reportsTableMissing ? 'Reports not set up yet' : 'Pending Reports',
                style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.w600),
              ),
              subtitle: stats.reportsTableMissing
                  ? Text(
                      "The reports table hasn't been created in AWS yet.",
                      style: TextStyle(color: context.textSecondary, fontSize: 12),
                    )
                  : null,
              trailing: stats.reportsTableMissing
                  ? null
                  : Text(
                      '${stats.pendingReports}',
                      style: TextStyle(
                        color: context.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _StatCard({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: AppColors.brandOrange, size: 22),
          Text(
            value,
            style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold, fontSize: 20),
          ),
          Text(
            label,
            style: TextStyle(color: context.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
