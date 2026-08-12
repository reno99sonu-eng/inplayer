/// Friendly "3h ago" / "2d ago" relative time, shared by any screen
/// rendering a raw ISO timestamp from the backend (watch history,
/// watchlist, notifications, comments all do their own local version of
/// this same formatting — kept centralized here for new screens).
String formatTimeAgo(String? iso) {
  if (iso == null || iso.isEmpty) return '';

  DateTime dateTime;
  try {
    dateTime = DateTime.parse(iso);
  } catch (_) {
    return '';
  }

  final diff = DateTime.now().difference(dateTime);
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 30) return '${diff.inDays}d ago';
  return '${(diff.inDays / 30).floor()}mo ago';
}
