import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/admin_ai_moderation.dart';
import '../widgets/admin_common.dart';

/// Read-only observability for the AI auto-moderation pipeline (GET
/// /api/admin/ai-moderation) — what it's been catching, not where its
/// on/off switches live (those are on the Platform Settings screen,
/// PATCH /api/admin/settings). Mirrors app/api/admin/ai-moderation/route.ts.
class AdminAiModerationTab extends ConsumerStatefulWidget {
  const AdminAiModerationTab({super.key});

  @override
  ConsumerState<AdminAiModerationTab> createState() => _AdminAiModerationTabState();
}

class _AdminAiModerationTabState extends ConsumerState<AdminAiModerationTab> {
  bool _loading = true;
  AdminAiModerationOverview? _overview;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final overview = await ref.read(adminServiceProvider).getAiModerationOverview();
    if (!mounted) return;
    setState(() {
      _overview = overview;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return adminLoadingCenter;
    final overview = _overview;
    if (overview == null) {
      return const AdminEmptyState(message: 'Failed to load moderation stats', icon: Icons.error_outline);
    }

    final sortedCategories = overview.categories.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final maxCategoryCount = sortedCategories.isEmpty ? 1 : sortedCategories.first.value;

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(14)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _toggleRow('Comments scanning', overview.moderationEnabledComments),
                _toggleRow('Messages scanning', overview.moderationEnabledMessages),
                _toggleRow('Upload scanning', overview.moderationEnabledUploads),
                const SizedBox(height: 6),
                const Text(
                  'Manage these switches in Platform Settings.',
                  style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 11, fontStyle: FontStyle.italic),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.1,
            children: [
              _countCard('Comments', overview.flaggedComments, Icons.mode_comment_outlined),
              _countCard('Messages', overview.flaggedMessages, Icons.chat_bubble_outline),
              _countCard('Uploads', overview.flaggedUploads, Icons.movie_outlined),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Flagged categories', style: TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600)),
          const SizedBox(height: 10),
          if (sortedCategories.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Text('Nothing flagged yet', style: TextStyle(color: AppColors.textSecondaryDark)),
            )
          else
            ...sortedCategories.map((e) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(e.key.replaceAll('_', ' '), style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 13)),
                          Text('${e.value}', style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: maxCategoryCount == 0 ? 0 : e.value / maxCategoryCount,
                          minHeight: 6,
                          backgroundColor: AppColors.cardDark,
                          valueColor: const AlwaysStoppedAnimation(AppColors.brandOrange),
                        ),
                      ),
                    ],
                  ),
                )),
        ],
      ),
    );
  }

  Widget _toggleRow(String label, bool enabled) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 13)),
          AdminStatusPill(label: enabled ? 'On' : 'Off', color: enabled ? AppColors.success : AppColors.textSecondaryDark),
        ],
      ),
    );
  }

  Widget _countCard(String label, int value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(14)),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: AppColors.error, size: 20),
          const SizedBox(height: 6),
          Text('$value', style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 16)),
          Text(label, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11)),
        ],
      ),
    );
  }
}
