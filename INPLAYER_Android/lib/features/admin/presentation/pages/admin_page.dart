import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
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
import 'admin_music_studio_tab.dart';
import 'admin_support_tab.dart';
import 'admin_hammart_orders_tab.dart';
import 'admin_sponsorships_tab.dart';
import 'admin_stuck_processing_tab.dart';

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
  AdminAccess? _access;

  @override
  void initState() {
    super.initState();
    _checkAccess();
  }

  Future<void> _checkAccess() async {
    final access = await ref.read(adminServiceProvider).getAccess();
    if (!mounted) return;
    setState(() {
      _access = access;
      _isAdmin = access.isAdmin;
      _loading = false;
    });
  }

  List<_AdminGroup> _groupsForAccess(AdminAccess access) {
    if (access.isMainAdmin) return _groups;

    final groups = <_AdminGroup>[];
    if (access.can('view_support')) {
      groups.add(_AdminGroup('Overview', [
        _AdminSection(
          'Support Desk',
          Icons.support_agent_outlined,
          () => const AdminSupportTab(readOnly: true),
        ),
      ]));
    }

    final contentSections = <_AdminSection>[];
    if (access.can('view_reports')) {
      contentSections.add(_AdminSection(
        'Moderation Reports',
        Icons.shield_outlined,
        () => const AdminModerationTab(reportsOnly: true, readOnly: true),
      ));
    }
    if (access.can('delete_stuck_processing_videos')) {
      contentSections.add(_AdminSection(
        'Stuck Uploads',
        Icons.hourglass_bottom_rounded,
        () => const AdminStuckProcessingTab(),
      ));
    }
    if (contentSections.isNotEmpty) {
      groups.add(_AdminGroup('Content & Safety', contentSections));
    }

    if (access.can('manage_ads') || access.can('manage_navbar_theme')) {
      groups.add(_AdminGroup('Appearance & Advertising', [
        _AdminSection(
          'Advertising & Navbar Theme',
          Icons.ads_click_outlined,
          () => AdminAdvertisingTab(
            canManageAds: access.can('manage_ads'),
            canManageNavbarTheme: access.can('manage_navbar_theme'),
          ),
        ),
      ]));
    }

    if (access.can('view_errors') || access.can('view_bugs')) {
      groups.add(_AdminGroup('Diagnostics', [
        _AdminSection(
          'Logs & Bug Reports',
          Icons.receipt_long_outlined,
          () => AdminLogsTab(
            canViewAudit: false,
            canViewErrors: access.can('view_errors'),
            canViewBugs: access.can('view_bugs'),
            canManage: false,
          ),
        ),
      ]));
    }
    return groups;
  }

  static final _groups = [
    _AdminGroup('Overview', [
      _AdminSection('Dashboard', Icons.dashboard_outlined, () => const AdminDashboardTab()),
      _AdminSection('Analytics & Revenue', Icons.bar_chart_outlined, () => const AdminAnalyticsTab()),
      _AdminSection('Support Desk', Icons.support_agent_outlined, () => const AdminSupportTab()),
    ]),
    _AdminGroup('Content & Moderation', [
      _AdminSection('Users', Icons.people_outline, () => const AdminUsersTab()),
      _AdminSection('Moderation', Icons.shield_outlined, () => const AdminModerationTab()),
      _AdminSection('All Content', Icons.video_library_outlined, () => const AdminContentTab()),
      _AdminSection('Videos', Icons.movie_outlined, () => const AdminContentTab(initialType: 'video')),
      _AdminSection('Raftaar Shorts', Icons.smart_display_outlined, () => const AdminContentTab(initialType: 'short')),
      _AdminSection('Music Studio', Icons.library_music_outlined, () => const AdminMusicStudioTab()),
      _AdminSection('Copyright Strikes', Icons.copyright_outlined, () => const AdminCopyrightTab()),
      _AdminSection('AI Moderation', Icons.smart_toy_outlined, () => const AdminAiModerationTab()),
    ]),
    _AdminGroup('Creators & Marketplace', [
      _AdminSection('Creator Payouts (KYC)', Icons.badge_outlined, () => const AdminCreatorsTab()),
      _AdminSection('Hammart Products & Vendors', Icons.storefront_outlined, () => const AdminHammartTab()),
      _AdminSection('Hammart Orders', Icons.receipt_outlined, () => const AdminHammartOrdersTab()),
    ]),
    _AdminGroup('Appearance & Advertising', [
      _AdminSection('Advertising & Ads', Icons.ads_click_outlined, () => const AdminAdvertisingTab()),
      _AdminSection('Sponsorships', Icons.monetization_on_outlined, () => const AdminSponsorshipsTab()),
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
        backgroundColor: Colors.transparent,
        body: Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
      );
    }

    if (!_isAdmin) {
      return PatternBackground(
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
            elevation: 0,
            iconTheme: IconThemeData(color: context.textPrimary),
            title: Text('Admin', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
          ),
          body: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    _access?.verificationFailed == true
                        ? Icons.cloud_off_outlined
                        : Icons.lock_outline,
                    size: 56,
                    color: context.textDim,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _access?.verificationFailed == true
                        ? "Couldn't verify admin access"
                        : "You don't have access to the admin panel",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _access?.verificationFailed == true
                        ? 'Check your connection and try again.'
                        : '${_access?.email ?? 'This account'} is not the main admin or an active team member.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: context.textSecondary, fontSize: 13),
                  ),
                  if (_access?.verificationFailed == true) ...[
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: () {
                        setState(() => _loading = true);
                        _checkAccess();
                      },
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      );
    }

    final access = _access!;
    final groups = _groupsForAccess(access);

    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          title: Text(
            'Admin Panel',
            style: TextStyle(fontWeight: FontWeight.w800, color: context.textPrimary, letterSpacing: -0.5),
          ),
        ),
        body: RefreshIndicator(
          color: AppColors.brandOrange,
          onRefresh: _checkAccess,
          child: ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: groups.length + (access.isMainAdmin ? 0 : 1),
            itemBuilder: (context, groupIndex) {
              if (!access.isMainAdmin && groupIndex == 0) {
                return _teamAccessNotice(context, access, groups.isEmpty);
              }
              final group = groups[groupIndex - (access.isMainAdmin ? 0 : 1)];
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
                        leading: Icon(section.icon, color: context.textPrimary),
                        title: Text(section.title, style: TextStyle(color: context.textPrimary, fontSize: 14)),
                        trailing: Icon(Icons.chevron_right, color: context.textDim, size: 20),
                        onTap: () => _open(section),
                      )),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _teamAccessNotice(
    BuildContext context,
    AdminAccess access,
    bool hasNoModules,
  ) {
    const labels = <String, String>{
      'view_reports': 'Reports',
      'view_support': 'Support',
      'view_bugs': 'Bug reports',
      'view_errors': 'Error logs',
      'manage_navbar_theme': 'Navbar theme',
      'manage_ads': 'Advertising',
      'delete_stuck_processing_videos': 'Stuck uploads',
    };
    final grants = access.permissions
        .map((permission) => labels[permission] ?? permission)
        .toList()
      ..sort();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.brandOrange.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Team access · ${access.email ?? 'signed-in account'}',
            style: TextStyle(
              color: context.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            hasNoModules
                ? 'This team account has no active permissions. Ask the main admin to grant specific sections, or sign in as inplayerdigital@gmail.com for the full console.'
                : 'This team account can use only the granted sections below. User management, revenue, sponsorships, full content controls, and global settings stay restricted to the main admin. Sign in as inplayerdigital@gmail.com to open the full console.',
            style: TextStyle(color: context.textSecondary, fontSize: 12, height: 1.45),
          ),
          if (grants.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Granted: ${grants.join(' · ')}',
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
