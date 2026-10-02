import 'package:share_plus/share_plus.dart';

import '../../models/video.dart';
import '../constants/api_constants.dart';

/// Shares any public content through the universal `/open/{videoId}` link.
/// The installed app resolves its media type and opens the matching player
/// when Android App Links are verified; the website resolves the matching
/// route.
///
/// Uses share_plus 11's `SharePlus.instance.share(ShareParams(...))` — the
/// same call the watch page makes. The older static `Share.share()` was
/// removed in 11.x, so anything copied from an older snippet will not
/// compile against the version this app resolves.
Future<void> shareVideoLink(Video video) async {
  await shareContentLink(videoId: video.videoId, title: video.title);
}

Future<void> shareContentLink({
  required String videoId,
  required String title,
}) async {
  final cleanTitle = title.trim();
  final label = cleanTitle.isEmpty ? 'InPlayer' : cleanTitle;
  final url =
      '${ApiConstants.websiteOrigin}/open/${Uri.encodeComponent(videoId)}';
  await SharePlus.instance.share(
    ShareParams(text: '$label\n$url', subject: label),
  );
}
