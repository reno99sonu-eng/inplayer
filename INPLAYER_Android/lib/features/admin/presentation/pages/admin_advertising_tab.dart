import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/admin_ad_creative.dart';
import '../../../../models/admin_navbar_theme.dart';
import '../widgets/admin_common.dart';

/// Advertising — static ad creatives (homepage/watch/weekly_featured),
/// mid-roll video-break creatives, and the navbar occasion theme, grouped
/// into one section since all three are "what visitors see on the site
/// that isn't user content." Manual image upload only in this build (via
/// image_picker -> data URI) — the website's AI "Magic Auto-Generate"
/// buttons (POST /api/admin/ai-ad-generate, /api/admin/ai-navbar-theme-
/// generate) are deliberately left out here; see the Round 8 project doc.
class AdminAdvertisingTab extends StatelessWidget {
  const AdminAdvertisingTab({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          Container(
            color: AppColors.backgroundDark,
            child: const TabBar(
              indicatorColor: AppColors.brandOrange,
              labelColor: AppColors.brandOrange,
              unselectedLabelColor: AppColors.textSecondaryDark,
              tabs: [Tab(text: 'Ads'), Tab(text: 'Mid-roll'), Tab(text: 'Navbar Theme')],
            ),
          ),
          const Expanded(
            child: TabBarView(children: [_AdsView(), _MidrollView(), _NavbarThemeView()]),
          ),
        ],
      ),
    );
  }
}

const _placements = ['homepage', 'watch', 'weekly_featured'];

class _AdsView extends ConsumerStatefulWidget {
  const _AdsView();

  @override
  ConsumerState<_AdsView> createState() => _AdsViewState();
}

class _AdsViewState extends ConsumerState<_AdsView> {
  bool _loading = true;
  bool _tableMissing = false;
  List<AdminAdCreative> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getAds();
    if (!mounted) return;
    setState(() {
      _items = result.items;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  Future<void> _create() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: AppColors.cardDark,
      isScrollControlled: true,
      builder: (context) => const _CreateAdSheet(),
    );
    if (created == true) _load();
  }

  Future<void> _toggleActive(AdminAdCreative ad) async {
    final ok = await ref.read(adminServiceProvider).updateAd(ad.adId, {'active': !ad.active});
    if (!mounted) return;
    if (ok) {
      _load();
    } else {
      showAdminSnack(context, "Couldn't update that.");
    }
  }

  Future<void> _delete(AdminAdCreative ad, int index) async {
    final confirmed = await confirmAdminDialog(context, title: 'Delete this ad?', content: '"${ad.title}" will be removed immediately.', confirmLabel: 'Delete');
    if (!confirmed) return;
    final ok = await ref.read(adminServiceProvider).deleteAd(ad.adId);
    if (!mounted) return;
    if (ok) {
      setState(() => _items = List.of(_items)..removeAt(index));
    } else {
      showAdminSnack(context, "Couldn't delete that.");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    return Stack(
      children: [
        if (_tableMissing)
          const AdminTableMissingNotice(message: "The ad creatives table hasn't been created in AWS yet.")
        else if (_items.isEmpty)
          const AdminEmptyState(message: 'No ad creatives yet', icon: Icons.ads_click_outlined)
        else
          RefreshIndicator(
            color: AppColors.brandOrange,
            backgroundColor: AppColors.surfaceDark,
            onRefresh: _load,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              itemCount: _items.length,
              separatorBuilder: (context, index) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final ad = _items[index];
                final thumb = smartImageProvider(ad.imageUrl);
                return Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(14)),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 70,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceDark,
                          borderRadius: BorderRadius.circular(8),
                          image: thumb != null ? DecorationImage(image: thumb, fit: BoxFit.cover) : null,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(ad.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600)),
                            const SizedBox(height: 2),
                            Wrap(spacing: 6, children: [
                              AdminStatusPill(label: ad.placement.replaceAll('_', ' '), color: AppColors.brandOrange),
                              Text('${ad.impressions} views • ${ad.clicks} clicks', style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11)),
                            ]),
                          ],
                        ),
                      ),
                      Column(
                        children: [
                          Switch(
                            value: ad.active,
                            onChanged: (_) => _toggleActive(ad),
                            activeTrackColor: AppColors.brandOrange,
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline, color: AppColors.error, size: 20),
                            onPressed: () => _delete(ad, index),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton(
            backgroundColor: AppColors.brandOrange,
            onPressed: _create,
            child: const Icon(Icons.add, color: Colors.white),
          ),
        ),
      ],
    );
  }
}

class _CreateAdSheet extends ConsumerStatefulWidget {
  const _CreateAdSheet();

  @override
  ConsumerState<_CreateAdSheet> createState() => _CreateAdSheetState();
}

class _CreateAdSheetState extends ConsumerState<_CreateAdSheet> {
  String _placement = 'homepage';
  String? _imageDataUrl;
  final _titleController = TextEditingController();
  final _linkController = TextEditingController();
  bool _saving = false;

  Future<void> _pickImage() async {
    final dataUrl = await pickImageAsDataUrl(maxDimension: 1200, quality: 75, maxChars: 150000);
    if (dataUrl == null) {
      if (mounted) showAdminSnack(context, 'Pick a smaller image (under ~110KB).');
      return;
    }
    setState(() => _imageDataUrl = dataUrl);
  }

  Future<void> _save() async {
    if (_imageDataUrl == null || _titleController.text.trim().isEmpty || !_linkController.text.trim().startsWith(RegExp(r'https?://'))) {
      showAdminSnack(context, 'Add an image, a title, and a valid http(s) link.');
      return;
    }
    setState(() => _saving = true);
    final result = await ref.read(adminServiceProvider).createAd(
          placement: _placement,
          imageUrl: _imageDataUrl!,
          linkUrl: _linkController.text.trim(),
          title: _titleController.text.trim(),
        );
    if (!mounted) return;
    setState(() => _saving = false);
    if (result.success) {
      Navigator.of(context).pop(true);
    } else {
      showAdminSnack(context, result.error ?? "Couldn't create that ad.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('New ad creative', style: TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            children: _placements
                .map((p) => ChoiceChip(
                      label: Text(p.replaceAll('_', ' ')),
                      selected: _placement == p,
                      onSelected: (_) => setState(() => _placement = p),
                      backgroundColor: AppColors.backgroundDark,
                      selectedColor: AppColors.brandOrange.withValues(alpha: 0.25),
                      labelStyle: TextStyle(color: _placement == p ? AppColors.brandOrange : AppColors.textSecondaryDark, fontSize: 12),
                      side: BorderSide.none,
                    ))
                .toList(),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _pickImage,
            child: Container(
              height: 90,
              decoration: BoxDecoration(
                color: AppColors.backgroundDark,
                borderRadius: BorderRadius.circular(12),
                image: _imageDataUrl != null
                    ? DecorationImage(image: smartImageProvider(_imageDataUrl!)!, fit: BoxFit.cover)
                    : null,
              ),
              child: _imageDataUrl == null
                  ? const Center(child: Icon(Icons.add_photo_alternate_outlined, color: AppColors.textSecondaryDark, size: 28))
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _titleController,
            style: const TextStyle(color: AppColors.textPrimaryDark),
            decoration: const InputDecoration(hintText: 'Title', hintStyle: TextStyle(color: AppColors.textSecondaryDark)),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _linkController,
            style: const TextStyle(color: AppColors.textPrimaryDark),
            decoration: const InputDecoration(hintText: 'https://...', hintStyle: TextStyle(color: AppColors.textSecondaryDark)),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving ? null : _save,
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandOrange),
              child: _saving
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Publish'),
            ),
          ),
        ],
      ),
    );
  }
}

class _MidrollView extends ConsumerStatefulWidget {
  const _MidrollView();

  @override
  ConsumerState<_MidrollView> createState() => _MidrollViewState();
}

class _MidrollViewState extends ConsumerState<_MidrollView> {
  bool _loading = true;
  bool _tableMissing = false;
  List<AdminMidrollAdCreative> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getMidrollAds();
    if (!mounted) return;
    setState(() {
      _items = result.items;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  Future<void> _create() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: AppColors.cardDark,
      isScrollControlled: true,
      builder: (context) => const _CreateMidrollSheet(),
    );
    if (created == true) _load();
  }

  Future<void> _toggleActive(AdminMidrollAdCreative ad) async {
    final ok = await ref.read(adminServiceProvider).updateMidrollAd(ad.adId, {'active': !ad.active});
    if (!mounted) return;
    if (ok) {
      _load();
    } else {
      showAdminSnack(context, "Couldn't update that.");
    }
  }

  Future<void> _delete(AdminMidrollAdCreative ad, int index) async {
    final confirmed = await confirmAdminDialog(context, title: 'Delete this ad?', content: '"${ad.title}" will be removed immediately.', confirmLabel: 'Delete');
    if (!confirmed) return;
    final ok = await ref.read(adminServiceProvider).deleteMidrollAd(ad.adId);
    if (!mounted) return;
    if (ok) {
      setState(() => _items = List.of(_items)..removeAt(index));
    } else {
      showAdminSnack(context, "Couldn't delete that.");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    return Stack(
      children: [
        if (_tableMissing)
          const AdminTableMissingNotice(message: "The mid-roll ads table hasn't been created in AWS yet.")
        else if (_items.isEmpty)
          const AdminEmptyState(message: 'No mid-roll ads yet', icon: Icons.smart_display_outlined)
        else
          RefreshIndicator(
            color: AppColors.brandOrange,
            backgroundColor: AppColors.surfaceDark,
            onRefresh: _load,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              itemCount: _items.length,
              separatorBuilder: (context, index) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final ad = _items[index];
                if (ad.isVideoUpload) {
                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(14)),
                    child: Row(
                      children: [
                        const Icon(Icons.videocam_outlined, color: AppColors.textSecondaryDark),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text('${ad.title} (video upload — manage on the website)',
                              style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
                        ),
                      ],
                    ),
                  );
                }
                final thumb = smartImageProvider(ad.imageUrl);
                return Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(14)),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 70,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceDark,
                          borderRadius: BorderRadius.circular(8),
                          image: thumb != null ? DecorationImage(image: thumb, fit: BoxFit.cover) : null,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(ad.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600)),
                            const SizedBox(height: 2),
                            Text('${ad.impressions} views • ${ad.clicks} clicks • ${ad.skips} skips', style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11)),
                          ],
                        ),
                      ),
                      Column(
                        children: [
                          Switch(value: ad.active, onChanged: (_) => _toggleActive(ad), activeTrackColor: AppColors.brandOrange),
                          IconButton(
                            icon: const Icon(Icons.delete_outline, color: AppColors.error, size: 20),
                            onPressed: () => _delete(ad, index),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton(
            backgroundColor: AppColors.brandOrange,
            onPressed: _create,
            child: const Icon(Icons.add, color: Colors.white),
          ),
        ),
      ],
    );
  }
}

class _CreateMidrollSheet extends ConsumerStatefulWidget {
  const _CreateMidrollSheet();

  @override
  ConsumerState<_CreateMidrollSheet> createState() => _CreateMidrollSheetState();
}

class _CreateMidrollSheetState extends ConsumerState<_CreateMidrollSheet> {
  String? _imageDataUrl;
  final _titleController = TextEditingController();
  final _linkController = TextEditingController();
  bool _saving = false;

  Future<void> _pickImage() async {
    final dataUrl = await pickImageAsDataUrl(maxDimension: 1200, quality: 75, maxChars: 150000);
    if (dataUrl == null) {
      if (mounted) showAdminSnack(context, 'Pick a smaller image (under ~110KB).');
      return;
    }
    setState(() => _imageDataUrl = dataUrl);
  }

  Future<void> _save() async {
    if (_imageDataUrl == null || _titleController.text.trim().isEmpty || !_linkController.text.trim().startsWith(RegExp(r'https?://'))) {
      showAdminSnack(context, 'Add an image, a title, and a valid http(s) link.');
      return;
    }
    setState(() => _saving = true);
    final result = await ref.read(adminServiceProvider).createMidrollAd(
          imageUrl: _imageDataUrl!,
          linkUrl: _linkController.text.trim(),
          title: _titleController.text.trim(),
        );
    if (!mounted) return;
    setState(() => _saving = false);
    if (result.success) {
      Navigator.of(context).pop(true);
    } else {
      showAdminSnack(context, result.error ?? "Couldn't create that ad.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('New mid-roll ad (image)', style: TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 4),
          const Text('Video-upload mid-roll ads aren\'t supported here — use the website for those.',
              style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 11)),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _pickImage,
            child: Container(
              height: 90,
              decoration: BoxDecoration(
                color: AppColors.backgroundDark,
                borderRadius: BorderRadius.circular(12),
                image: _imageDataUrl != null ? DecorationImage(image: smartImageProvider(_imageDataUrl!)!, fit: BoxFit.cover) : null,
              ),
              child: _imageDataUrl == null
                  ? const Center(child: Icon(Icons.add_photo_alternate_outlined, color: AppColors.textSecondaryDark, size: 28))
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _titleController,
            style: const TextStyle(color: AppColors.textPrimaryDark),
            decoration: const InputDecoration(hintText: 'Title', hintStyle: TextStyle(color: AppColors.textSecondaryDark)),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _linkController,
            style: const TextStyle(color: AppColors.textPrimaryDark),
            decoration: const InputDecoration(hintText: 'https://...', hintStyle: TextStyle(color: AppColors.textSecondaryDark)),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving ? null : _save,
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandOrange),
              child: _saving
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Publish'),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavbarThemeView extends ConsumerStatefulWidget {
  const _NavbarThemeView();

  @override
  ConsumerState<_NavbarThemeView> createState() => _NavbarThemeViewState();
}

class _NavbarThemeViewState extends ConsumerState<_NavbarThemeView> {
  bool _loading = true;
  AdminNavbarTheme? _theme;
  String? _pendingImageDataUrl;
  final _occasionNameController = TextEditingController();
  final _titleController = TextEditingController();
  bool _active = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final theme = await ref.read(adminServiceProvider).getNavbarTheme();
    if (!mounted) return;
    setState(() {
      _theme = theme;
      _occasionNameController.text = theme?.occasionName ?? '';
      _titleController.text = theme?.title ?? '';
      _active = theme?.active ?? true;
      _loading = false;
    });
  }

  Future<void> _pickImage() async {
    // Navbar graphic is rendered at ~48-56px tall — keep it small so the
    // 350,000-char DynamoDB item budget is never in danger.
    final dataUrl = await pickImageAsDataUrl(maxDimension: 300, quality: 85, maxChars: 300000);
    if (dataUrl == null) {
      if (mounted) showAdminSnack(context, 'Pick a smaller image.');
      return;
    }
    setState(() => _pendingImageDataUrl = dataUrl);
  }

  Future<void> _save() async {
    final imageUrl = _pendingImageDataUrl ?? _theme?.imageUrl;
    if (imageUrl == null || imageUrl.isEmpty) {
      showAdminSnack(context, 'Pick an image first.');
      return;
    }
    setState(() => _saving = true);
    final result = await ref.read(adminServiceProvider).setNavbarTheme(
          imageUrl: imageUrl,
          occasionName: _occasionNameController.text.trim().isEmpty ? null : _occasionNameController.text.trim(),
          title: _titleController.text.trim().isEmpty ? null : _titleController.text.trim(),
          active: _active,
        );
    if (!mounted) return;
    setState(() => _saving = false);
    if (result.success) {
      showAdminSnack(context, 'Theme saved.');
      _pendingImageDataUrl = null;
      _load();
    } else {
      showAdminSnack(context, result.error ?? "Couldn't save that.");
    }
  }

  Future<void> _delete() async {
    final confirmed = await confirmAdminDialog(context, title: 'Remove the theme?', content: 'The navbar goes back to its default look.', confirmLabel: 'Remove');
    if (!confirmed) return;
    final ok = await ref.read(adminServiceProvider).deleteNavbarTheme();
    if (!mounted) return;
    if (ok) {
      _load();
    } else {
      showAdminSnack(context, "Couldn't remove that.");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    final previewProvider = _pendingImageDataUrl != null
        ? smartImageProvider(_pendingImageDataUrl!)
        : (_theme != null && _theme!.imageUrl.isNotEmpty ? smartImageProvider(_theme!.imageUrl) : null);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        GestureDetector(
          onTap: _pickImage,
          child: Container(
            height: 100,
            decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(14)),
            child: Center(
              child: previewProvider != null
                  ? Image(image: previewProvider, height: 56, fit: BoxFit.contain)
                  : const Icon(Icons.add_photo_alternate_outlined, color: AppColors.textSecondaryDark, size: 28),
            ),
          ),
        ),
        const SizedBox(height: 6),
        const Text('Tap to change the graphic. Rendered small (~48-56px) behind the navbar logo.',
            style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 11)),
        const SizedBox(height: 14),
        TextField(
          controller: _occasionNameController,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: const InputDecoration(labelText: 'Occasion name', labelStyle: TextStyle(color: AppColors.textSecondaryDark)),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _titleController,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: const InputDecoration(labelText: 'Title (alt text)', labelStyle: TextStyle(color: AppColors.textSecondaryDark)),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          value: _active,
          onChanged: (v) => setState(() => _active = v),
          title: const Text('Active on the site', style: TextStyle(color: AppColors.textPrimaryDark)),
          activeTrackColor: AppColors.brandOrange,
          contentPadding: EdgeInsets.zero,
        ),
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: _saving ? null : _save,
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandOrange, minimumSize: const Size.fromHeight(46)),
          child: _saving
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Save theme'),
        ),
        if (_theme != null) ...[
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _delete,
            style: OutlinedButton.styleFrom(foregroundColor: AppColors.error, minimumSize: const Size.fromHeight(46)),
            child: const Text('Remove theme'),
          ),
        ],
      ],
    );
  }
}
