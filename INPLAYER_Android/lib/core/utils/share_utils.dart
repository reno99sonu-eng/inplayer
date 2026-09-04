import 'package:share_plus/share_plus.dart';

import '../../models/video.dart';
import '../constants/api_constants.dart';

/// Shares a video or music track by its public website link.
///
/// Music tracks live on the same `/watch/{videoId}` route as videos on the
/// site, so one helper covers both and there is no second URL shape to keep
/// in sync.
///
/// Uses share_plus 11's `SharePlus.instance.share(ShareParams(...))` — the
/// same call the watch page makes. The older static `Share.share()` was
/// removed in 11.x, so anything copied from an older snippet will not
/// compile against the version this app resolves.
Future<void> shareVideoLink(Video video) async {
  final title = video.title.trim();
  final label = title.isEmpty ? 'InPlayer' : title;
  final url = '${ApiConstants.websiteOrigin}/watch/${video.videoId}';
  await SharePlus.instance.share(
    ShareParams(text: '$label\n$url', subject: label),
  );
}
