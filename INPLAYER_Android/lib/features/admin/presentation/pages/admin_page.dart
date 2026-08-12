import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/admin_service.dart';
import '../widgets/admin_common.dart';
import 'admin_dashboard_tab.dart';
import 'admin_users_tab.dart';
import 'admin_moderation_tab.dart';
import 'admin_analytics_tab.dart';
import 'admin_content_tab.dart';
import 'admin_creators_tab.dart';
import 'admin_copyright_tab.dart';
import 'admin_ai_moderation_tab.dart';
import 'admin_hammart_tab.dart';
import 'admin_advertising_tab.dart';
import 'admin_settings_tab.dart';
import 'admin_notifications_tab.dart';
import 'admin_logs_tab.dart';
import 'admin_maintenance_tab.dart';

/// Gate + full admin panel shell. GET /api/admin/me is the only way a
/// client can know whether the signed-in account is an admin (the real
/// allowlist is a server-only env var) — checked once here before
/// anything admin-only renders, same as the website's own
/// app/admin/layout.tsx does.
///
/// Round 7 shipped Dashboard/Users/Moderation on a 3-tab bottom
/// NavigationBar. This round ("finish whole admin panel") adds every
/// remaining section from the website's admin console — grown from 3 to
/// 14 sections, well past what a bottom nav bar can reasonably hold — so
/// the shell is now a scrollable menu of section tiles, each pushed as its
/// own full page. Dashboard stays the very first thing an admin sees.
class AdminPage extends ConsumerStatefulWidget {
  const AdminPage({super.key});

  @override
  ConsumerState<AdminPage> createState() => _AdminPageState();
}

class _AdminSection {
  final String title;
  final IconData icon;
  final Widget Function() builder;
  const _AdminSection(this.title, this.icon, this.builder);
}

class _AdminGroup {
  final String label;
  final List<_AdminSection> sections;
  const _AdminGroup(this.label, this.sections);
}

class _AdminPageState extends ConsumerState<AdminPage> {
  bool _loading = true;
  bool _isAdmin = false;

  @override
  void initState() {
    super.initState();
    _checkAccess();
  }

  Future<void> _checkAccess() async {
    final isAdmin = await ref.read(adminServiceProvider).checkIsAdmin();
    if (!mounted) return;
    setState(() {
      _isAdmin = isAdmin;
      _loading = false;
    });
  }

  static final _groups = [
    _AdminGroup('Overview', [
      _AdminSection('Dashboard', Icons.dashboard_outlined, () => const AdminDashboardTab()),
      _AdminSection('Analytics & Revenue', Icons.bar_chart_outlined, () => const AdminAnalyticsTab()),
    ]),
    _AdminGroup('Content & Moderation', [
      _AdminSection('Users', Icons.people_outline, () => const AdminUsersTab()),
      _AdminSection('Moderation', Icons.shield_outlined, () => const AdminModerationTab()),
      _AdminSection('Content Browser', Icons.video_library_outlined, () => const AdminContentTab()),
      _AdminSection('Copyright Strikes', Icons.copyright_outlined, () => const AdminCopyrightTab()),
      _AdminSection('AI Moderation', Icons.smart_toy_outlined, () => const AdminAiModerationTab()),
    ]),
    _AdminGroup('Creators & Marketplace', [
      _AdminSection('Creator Payouts (KYC)', Icons.badge_outlined, () => const AdminCreatorsTab()),
      _AdminSection('Hammart Products & Vendors', Icons.storefront_outlined, () => const AdminHammartTab()),
    ]),
    _AdminGroup('Appearance & Advertising', [
      _AdminSection('Advertising', Icons.ads_click_outlined, () => const AdminAdvertisingTab()),
    ]),
    _AdminGroup('Platform', [
      _AdminSection('Settings', Icons.settings_outlined, () => const AdminSettingsTab()),
      _AdminSection('Notifications', Icons.campaign_outlined, () => const AdminNotificationsTab()),
    ]),
    _AdminGroup('Diagnostics', [
      _AdminSection('Logs & Bug Reports', Icons.receipt_long_outlined, () => const AdminLogsTab()),
      _AdminSection('Maintenance Tools', Icons.build_outlined, () => const AdminMaintenanceTab()),
    ]),
  ];

  void _open(_AdminSection section) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (context) => AdminSectionPage(title: section.title, child: section.builder())),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.backgroundDark,
        body: Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
      );
    }

    if (!_isAdmin) {
      return Scaffold(
        backgroundColor: AppColors.backgroundDark,
        appBar: AppBar(
          backgroundColor: AppColors.backgroundDark,
          elevation: 0,
          title: const Text('Admin', style: TextStyle(color: AppColors.textPrimaryDark)),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lock_outline, size: 56, color: AppColors.textSecondaryDark),
                const SizedBox(height: 16),
                const Text(
                  "You don't have access to the admin panel",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(
                  'This account is not on the InPlayer admin list.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textSecondaryDark.withValues(alpha: 0.8), fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text('Admin Panel', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark)),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _groups.length,
        itemBuilder: (context, groupIndex) {
          final group = _groups[groupIndex];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 6),
                child: Text(
                  group.label.toUpperCase(),
                  style: const TextStyle(color: AppColors.brandOrange, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                ),
              ),
              ...group.sections.map((section) => ListTile(
                    leading: Icon(section.icon, color: AppColors.textPrimaryDark),
                    title: Text(section.title, style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 14)),
                    trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondaryDark, size: 20),
                    onTap: () => _open(section),
                  )),
            ],
          );
        },
      ),
    );
  }
}
