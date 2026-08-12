/// GET /api/admin/ai-moderation — observability dashboard for the
/// auto-moderation pipeline. Mirrors app/api/admin/ai-moderation/route.ts.
/// The `settings` booleans here are read-only mirrors of the same fields
/// the Platform Settings screen actually controls (moderationEnabled...);
/// this screen is purely "what's the pipeline been catching," not where
/// those toggles live.
class AdminAiModerationOverview {
  final bool moderationEnabledComments;
  final bool moderationEnabledMessages;
  final bool moderationEnabledUploads;
  final int flaggedComments;
  final int flaggedMessages;
  final int flaggedUploads;
  final Map<String, int> categories;

  AdminAiModerationOverview({
    this.moderationEnabledComments = true,
    this.moderationEnabledMessages = true,
    this.moderationEnabledUploads = true,
    this.flaggedComments = 0,
    this.flaggedMessages = 0,
    this.flaggedUploads = 0,
    this.categories = const {},
  });

  factory AdminAiModerationOverview.fromJson(Map<String, dynamic> json) {
    final settings = (json['settings'] as Map?) ?? {};
    final counts = (json['counts'] as Map?) ?? {};
    final categoriesRaw = (json['categories'] as Map?) ?? {};
    final categories = <String, int>{};
    for (final entry in categoriesRaw.entries) {
      categories[entry.key.toString()] = (entry.value as num?)?.toInt() ?? 0;
    }
    return AdminAiModerationOverview(
      moderationEnabledComments: settings['moderationEnabledComments'] != false,
      moderationEnabledMessages: settings['moderationEnabledMessages'] != false,
      moderationEnabledUploads: settings['moderationEnabledUploads'] != false,
      flaggedComments: (counts['comments'] as num?)?.toInt() ?? 0,
      flaggedMessages: (counts['messages'] as num?)?.toInt() ?? 0,
      flaggedUploads: (counts['uploads'] as num?)?.toInt() ?? 0,
      categories: categories,
    );
  }
}
