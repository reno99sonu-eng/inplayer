import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/admin_platform_settings.dart';
import '../widgets/admin_common.dart';

/// Platform Settings — the actual on/off switches and text config that
/// control site-wide behavior (GET/PATCH /api/admin/settings). Mirrors the
/// whitelist in app/api/admin/settings/route.ts exactly; only changed
/// fields are ever sent on save.
class AdminSettingsTab extends ConsumerStatefulWidget {
  const AdminSettingsTab({super.key});

  @override
  ConsumerState<AdminSettingsTab> createState() => _AdminSettingsTabState();
}

class _AdminSettingsTabState extends ConsumerState<AdminSettingsTab> {
  bool _loading = true;
  bool _saving = false;
  AdminPlatformSettings? _original;
  AdminPlatformSettings? _current;

  late final TextEditingController _maintenanceMsgController;
  late final TextEditingController _announcementTextController;
  late final TextEditingController _announcementLinkController;
  late final TextEditingController _adsensePublisherController;
  late final TextEditingController _midrollIntervalController;

  @override
  void initState() {
    super.initState();
    _maintenanceMsgController = TextEditingController();
    _announcementTextController = TextEditingController();
    _announcementLinkController = TextEditingController();
    _adsensePublisherController = TextEditingController();
    _midrollIntervalController = TextEditingController();
    _load();
  }

  @override
  void dispose() {
    _maintenanceMsgController.dispose();
    _announcementTextController.dispose();
    _announcementLinkController.dispose();
    _adsensePublisherController.dispose();
    _midrollIntervalController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final settings = await ref.read(adminServiceProvider).getPlatformSettings();
    if (!mounted) return;
    setState(() {
      _original = settings;
      _current = settings;
      _maintenanceMsgController.text = settings?.maintenanceMessage ?? '';
      _announcementTextController.text = settings?.announcementText ?? '';
      _announcementLinkController.text = settings?.announcementLinkUrl ?? '';
      _adsensePublisherController.text = settings?.adsensePublisherId ?? '';
      _midrollIntervalController.text = '${settings?.midrollIntervalSeconds ?? 900}';
      _loading = false;
    });
  }

  Future<void> _save() async {
    final current = _current;
    final original = _original;
    if (current == null || original == null) return;

    final parsedInterval = int.tryParse(_midrollIntervalController.text.trim());
    final midrollIntervalSeconds = parsedInterval == null
        ? original.midrollIntervalSeconds
        : parsedInterval.clamp(60, 3600).toInt();

    final updated = current.copyWith(
      maintenanceMessage: _maintenanceMsgController.text.trim(),
      announcementText: _announcementTextController.text.trim(),
      announcementLinkUrl: _announcementLinkController.text.trim(),
      adsensePublisherId: _adsensePublisherController.text.trim(),
      midrollIntervalSeconds: midrollIntervalSeconds,
    );

    final partial = <String, dynamic>{};
    if (updated.maintenanceMode != original.maintenanceMode) partial['maintenanceMode'] = updated.maintenanceMode;
    if (updated.maintenanceMessage != original.maintenanceMessage) partial['maintenanceMessage'] = updated.maintenanceMessage;
    if (updated.signupsEnabled != original.signupsEnabled) partial['signupsEnabled'] = updated.signupsEnabled;
    if (updated.announcementEnabled != original.announcementEnabled) partial['announcementEnabled'] = updated.announcementEnabled;
    if (updated.announcementText != original.announcementText) partial['announcementText'] = updated.announcementText;
    if (updated.announcementLinkUrl != original.announcementLinkUrl) partial['announcementLinkUrl'] = updated.announcementLinkUrl;
    if (updated.moderationEnabledComments != original.moderationEnabledComments) partial['moderationEnabledComments'] = updated.moderationEnabledComments;
    if (updated.moderationEnabledMessages != original.moderationEnabledMessages) partial['moderationEnabledMessages'] = updated.moderationEnabledMessages;
    if (updated.moderationEnabledUploads != original.moderationEnabledUploads) partial['moderationEnabledUploads'] = updated.moderationEnabledUploads;
    if (updated.adsenseEnabled != original.adsenseEnabled) partial['adsenseEnabled'] = updated.adsenseEnabled;
    if (updated.adsensePublisherId != original.adsensePublisherId) partial['adsensePublisherId'] = updated.adsensePublisherId;
    if (updated.homepageBannerSource != original.homepageBannerSource) partial['homepageBannerSource'] = updated.homepageBannerSource;
    if (updated.watchPageBannerSource != original.watchPageBannerSource) partial['watchPageBannerSource'] = updated.watchPageBannerSource;
    if (updated.weeklyFeaturedEnabled != original.weeklyFeaturedEnabled) partial['weeklyFeaturedEnabled'] = updated.weeklyFeaturedEnabled;
    if (updated.midrollEnabled != original.midrollEnabled) partial['midrollEnabled'] = updated.midrollEnabled;
    if (updated.midrollIntervalSeconds != original.midrollIntervalSeconds) partial['midrollIntervalSeconds'] = updated.midrollIntervalSeconds;

    if (partial.isEmpty) {
      showAdminSnack(context, 'Nothing changed.');
      return;
    }

    setState(() => _saving = true);
    final result = await ref.read(adminServiceProvider).updatePlatformSettings(partial);
    if (!mounted) return;
    setState(() => _saving = false);
    if (result != null) {
      showAdminSnack(context, 'Settings saved.');
      setState(() {
        _original = result;
        _current = result;
      });
    } else {
      showAdminSnack(context, "Couldn't save settings. Try again.");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    final current = _current;
    if (current == null) {
      return const AdminEmptyState(message: 'Failed to load settings', icon: Icons.error_outline);
    }

    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
          children: [
            _sectionTitle('Site availability'),
            _switchTile('Maintenance mode', current.maintenanceMode, (v) => setState(() => _current = current.copyWith(maintenanceMode: v))),
            _textField(_maintenanceMsgController, 'Maintenance message', maxLines: 2),
            _switchTile('New signups enabled', current.signupsEnabled, (v) => setState(() => _current = current.copyWith(signupsEnabled: v))),
            const SizedBox(height: 12),
            _sectionTitle('Announcement banner'),
            _switchTile('Announcement enabled', current.announcementEnabled, (v) => setState(() => _current = current.copyWith(announcementEnabled: v))),
            _textField(_announcementTextController, 'Announcement text', maxLines: 2),
            _textField(_announcementLinkController, 'Announcement link (optional)'),
            const SizedBox(height: 12),
            _sectionTitle('AI moderation'),
            _switchTile('Scan comments', current.moderationEnabledComments, (v) => setState(() => _current = current.copyWith(moderationEnabledComments: v))),
            _switchTile('Scan messages', current.moderationEnabledMessages, (v) => setState(() => _current = current.copyWith(moderationEnabledMessages: v))),
            _switchTile('Scan uploads', current.moderationEnabledUploads, (v) => setState(() => _current = current.copyWith(moderationEnabledUploads: v))),
            const SizedBox(height: 12),
            _sectionTitle('Advertising'),
            _switchTile('AdSense enabled', current.adsenseEnabled, (v) => setState(() => _current = current.copyWith(adsenseEnabled: v))),
            _textField(_adsensePublisherController, 'AdSense publisher ID'),
            _sourceDropdown('Homepage banner source', current.homepageBannerSource, (v) => setState(() => _current = current.copyWith(homepageBannerSource: v))),
            _sourceDropdown('Watch page banner source', current.watchPageBannerSource, (v) => setState(() => _current = current.copyWith(watchPageBannerSource: v))),
            _switchTile('Weekly featured banner', current.weeklyFeaturedEnabled, (v) => setState(() => _current = current.copyWith(weeklyFeaturedEnabled: v))),
            _switchTile('Mid-roll ads enabled', current.midrollEnabled, (v) => setState(() => _current = current.copyWith(midrollEnabled: v))),
            _textField(_midrollIntervalController, 'Mid-roll interval (seconds, 60-3600)', keyboardType: TextInputType.number),
          ],
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 16,
          child: ElevatedButton(
            onPressed: _saving ? null : _save,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandOrange, minimumSize: const Size.fromHeight(48)),
            child: _saving
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Save settings'),
          ),
        ),
      ],
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Text(title, style: const TextStyle(color: AppColors.brandOrange, fontWeight: FontWeight.bold, fontSize: 13)),
    );
  }

  Widget _switchTile(String label, bool value, ValueChanged<bool> onChanged) {
    return SwitchListTile(
      value: value,
      onChanged: onChanged,
      title: Text(label, style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 13)),
      activeTrackColor: AppColors.brandOrange,
      contentPadding: EdgeInsets.zero,
      dense: true,
    );
  }

  Widget _textField(TextEditingController controller, String label, {int maxLines = 1, TextInputType? keyboardType}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        keyboardType: keyboardType,
        style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 13),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
          isDense: true,
        ),
      ),
    );
  }

  Widget _sourceDropdown(String label, String value, ValueChanged<String> onChanged) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 13)),
          DropdownButton<String>(
            value: value,
            dropdownColor: AppColors.cardDark,
            style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 13),
            underline: const SizedBox.shrink(),
            items: const [
              DropdownMenuItem(value: 'house', child: Text('House')),
              DropdownMenuItem(value: 'adsense', child: Text('AdSense')),
              DropdownMenuItem(value: 'off', child: Text('Off')),
            ],
            onChanged: (v) {
              if (v != null) onChanged(v);
            },
          ),
        ],
      ),
    );
  }
}
