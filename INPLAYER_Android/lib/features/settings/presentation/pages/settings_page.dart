import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
  final ScrollController _scrollController = ScrollController();
  final Map<String, GlobalKey> _sectionKeys = {};
  bool _pushNotifications = true;
  bool _prefsLoaded = false;
  bool _deletingAccount = false;
  int _activeSectionIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
    _scrollController.addListener(_updateActiveSectionFromScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_updateActiveSectionFromScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _updateActiveSectionFromScroll() {
    var closest = 0;
    var closestDistance = double.infinity;

    for (int i = 0; i < _sectionKeys.length; i++) {
      final key = _sectionKeys.values.elementAt(i);
      final renderBox = key.currentContext?.findRenderObject() as RenderBox?;
      if (renderBox == null) continue;
      final position = renderBox
          .localToGlobal(Offset.zero, ancestor: context.findRenderObject())
          .dy;
      final distance = (position - 120).abs();
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = i;
      }
    }

    if (closest != _activeSectionIndex && mounted) {
      setState(() => _activeSectionIndex = closest);
    }
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
        backgroundColor: context.isDark
            ? AppColors.surfaceDark
            : AppColors.surfaceLight,
      ),
    );
  }

  void _jumpToSection(String title, {List<_SettingsSection>? sections}) {
    final key = _sectionKeys[title];
    final sectionContext = key?.currentContext;
    if (sectionContext == null) return;

    final sectionIndex = sectionsByTitle(title, sections ?? const []);
    setState(() => _activeSectionIndex = sectionIndex);
    Scrollable.ensureVisible(
      sectionContext,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      alignment: 0.08,
    );
  }

  int sectionsByTitle(String title, List<_SettingsSection> sections) {
    for (int i = 0; i < sections.length; i++) {
      if (sections[i].title == title) return i;
    }
    return 0;
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
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
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
                          color: isSelected
                              ? AppColors.brandOrange
                              : ctx.textSecondary,
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
                                  color: isSelected
                                      ? AppColors.brandOrange
                                      : ctx.textPrimary,
                                  fontWeight: isSelected
                                      ? FontWeight.bold
                                      : FontWeight.w500,
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
                          const Icon(
                            Icons.check_circle,
                            color: AppColors.brandOrange,
                            size: 20,
                          ),
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
        title: Text(
          'Delete Account',
          style: TextStyle(color: ctx.textPrimary, fontWeight: FontWeight.bold),
        ),
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
            child: const Text(
              'Delete',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true || _deletingAccount) return;

    setState(() => _deletingAccount = true);

    final dataResult = await ref
        .read(settingsServiceProvider)
        .deleteAccountData();

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
      _showSnack(
        authResult.error ??
            "Your data was deleted, but signing you out failed.",
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentTheme = ref.watch(themeChoiceProvider);

    final sections = _buildSections(currentTheme);

    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        automaticallyImplyLeading: false,
        leading: Navigator.of(context).canPop()
            ? IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: Icon(
                  Icons.arrow_back_ios_new_rounded,
                  color: context.textPrimary,
                ),
              )
            : null,
        title: Text(
          'Settings',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: context.textPrimary,
            fontSize: 20,
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
              child: SizedBox(
                height: 42,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: sections.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final section = sections[index];
                    final selected = index == _activeSectionIndex;
                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () =>
                            _jumpToSection(section.title, sections: sections),
                        borderRadius: BorderRadius.circular(12),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          curve: Curves.easeOutCubic,
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          decoration: BoxDecoration(
                            color: selected
                                ? AppColors.brandOrange
                                : context.isDark
                                ? Colors.white.withValues(alpha: 0.04)
                                : Colors.black.withValues(alpha: 0.03),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: selected
                                  ? AppColors.brandOrange.withValues(
                                      alpha: 0.35,
                                    )
                                  : context.borderSubtle,
                            ),
                            boxShadow: selected
                                ? [
                                    BoxShadow(
                                      color: AppColors.brandOrange.withValues(
                                        alpha: 0.18,
                                      ),
                                      blurRadius: 12,
                                      offset: const Offset(0, 4),
                                    ),
                                  ]
                                : null,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            section.title,
                            style: TextStyle(
                              color: selected
                                  ? Colors.white
                                  : context.textPrimary,
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
            Expanded(
              child: ListView(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 28),
                children: [
                  for (final section in sections)
                    Padding(
                      key: _sectionKeys.putIfAbsent(
                        section.title,
                        () => GlobalKey(),
                      ),
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Container(
                        decoration: BoxDecoration(
                          color: context.bgCard,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: context.borderSubtle),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                              child: Text(
                                section.title.toUpperCase(),
                                style: const TextStyle(
                                  color: AppColors.brandOrange,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 11,
                                  letterSpacing: 1.2,
                                ),
                              ),
                            ),
                            ...section.items.map((item) => item.build(context)),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<_SettingsSection> _buildSections(ThemeChoice currentTheme) {
    return [
      _SettingsSection(
        title: 'Profile',
        items: [
          _SettingTile(
            icon: Icons.person_outline,
            title: 'Edit Profile & Avatar',
            onTap: () => context.push('/settings/edit-profile'),
          ),
          _SettingTile(
            icon: Icons.mail_outline,
            title: 'Email Address',
            onTap: () => context.push('/settings/change-email'),
          ),
          _SettingTile(
            icon: Icons.lock_outline,
            title: 'Change Password',
            onTap: () => context.push('/settings/change-password'),
          ),
          _SettingTile(
            icon: Icons.language_outlined,
            title: 'Language',
            trailing: Text(
              'English',
              style: TextStyle(color: context.textDim, fontSize: 13),
            ),
            onTap: () =>
                _showSnack('InPlayer is currently available in English only.'),
          ),
        ],
      ),
      _SettingsSection(
        title: 'Privacy',
        items: [
          _SettingTile(
            icon: Icons.visibility_outlined,
            title: 'Privacy, Passkeys & Active Sessions',
            onTap: () => context.push('/settings/privacy'),
          ),
          _SettingTile(
            icon: Icons.block_outlined,
            title: 'Blocked Users',
            onTap: () => context.push('/settings/blocked-users'),
          ),
          _SettingSwitch(
            icon: Icons.notifications_outlined,
            title: 'Push Notifications',
            value: _pushNotifications,
            onChanged: _prefsLoaded ? _setPushNotifications : null,
          ),
        ],
      ),
      _SettingsSection(
        title: 'Playback',
        items: [
          _SettingTile(
            icon: Icons.play_circle_outline,
            title: 'Streaming & Quality Preferences',
            onTap: () => context.push('/settings/playback'),
          ),
          _SettingTile(
            icon: Icons.download_for_offline_outlined,
            title: 'Downloads & Offline Videos',
            onTap: () => context.push('/downloads'),
          ),
        ],
      ),
      _SettingsSection(
        title: 'Premium',
        items: [
          _SettingTile(
            icon: Icons.workspace_premium_outlined,
            title: 'Premium Plans & Subscriptions',
            onTap: () => context.push('/settings/plans'),
          ),
        ],
      ),
      _SettingsSection(
        title: 'Revenue',
        items: [
          _SettingTile(
            icon: Icons.insights_outlined,
            title: 'Creator & Upload Analytics',
            onTap: () => context.push('/settings/analytics'),
          ),
          _SettingTile(
            icon: Icons.storage_outlined,
            title: 'Cloud Storage & Uploads Overview',
            onTap: () => context.push('/settings/storage'),
          ),
        ],
      ),
      _SettingsSection(
        title: 'KYC',
        items: [
          _SettingTile(
            icon: Icons.fact_check_outlined,
            title: 'Creator KYC & Monetization',
            onTap: () => context.push('/creator/kyc'),
          ),
        ],
      ),
      _SettingsSection(
        title: 'Appearance',
        items: [
          _SettingTile(
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
        ],
      ),
      _SettingsSection(
        title: 'Legal',
        items: [
          _SettingTile(
            icon: Icons.info_outline,
            title: 'About InPlayer',
            onTap: _showAbout,
          ),
          _SettingTile(
            icon: Icons.bug_report_outlined,
            title: 'Report a Problem',
            onTap: () => context.push('/settings/report-problem'),
          ),
          _SettingTile(
            icon: Icons.help_outline,
            title: 'Help Center',
            onTap: () => context.push('/settings/help'),
          ),
          _SettingTile(
            icon: Icons.email_outlined,
            title: 'Contact Support',
            onTap: () => context.push('/contact'),
          ),
          _SettingTile(
            icon: Icons.description_outlined,
            title: 'Terms of Service',
            onTap: () => context.push('/settings/terms'),
          ),
          _SettingTile(
            icon: Icons.storefront_outlined,
            title: 'HamMart Vendor Terms',
            onTap: () => context.push('/settings/vendor-terms'),
          ),
          _SettingTile(
            icon: Icons.privacy_tip_outlined,
            title: 'Privacy Policy',
            onTap: () => context.push('/settings/privacy-policy'),
          ),
        ],
      ),
      _SettingsSection(
        title: 'Account controls',
        items: [
          _SettingTile(
            icon: Icons.delete_forever_outlined,
            title: _deletingAccount
                ? 'Deleting your account...'
                : 'Delete Account',
            onTap: _deletingAccount ? () {} : _confirmDeleteAccount,
            isDestructive: true,
            trailing: _deletingAccount
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.error,
                    ),
                  )
                : null,
          ),
        ],
      ),
    ];
  }
}

class _SettingsSection {
  final String title;
  final List<_SettingsItem> items;

  const _SettingsSection({required this.title, required this.items});
}

abstract class _SettingsItem {
  Widget build(BuildContext context);
}

class _SettingTile extends _SettingsItem {
  final IconData icon;
  final String title;
  final Widget? trailing;
  final VoidCallback onTap;
  final bool isDestructive;

  _SettingTile({
    required this.icon,
    required this.title,
    required this.onTap,
    this.trailing,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Icon(
                icon,
                color: isDestructive ? AppColors.error : context.textPrimary,
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: isDestructive
                        ? AppColors.error
                        : context.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              if (trailing != null)
                trailing!
              else
                Icon(Icons.chevron_right, color: context.textDim, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _SettingSwitch extends _SettingsItem {
  final IconData icon;
  final String title;
  final bool value;
  final ValueChanged<bool>? onChanged;

  _SettingSwitch({
    required this.icon,
    required this.title,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Icon(icon, color: context.textPrimary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Transform.scale(
            scale: 0.8,
            child: Switch.adaptive(
              value: value,
              activeThumbColor: Colors.white,
              activeTrackColor: AppColors.brandOrange,
              inactiveThumbColor: Colors.white,
              inactiveTrackColor: context.isDark
                  ? const Color(0xFF475569)
                  : const Color(0xFFCBD5E1),
              onChanged: onChanged,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
        ],
      ),
    );
  }
}
