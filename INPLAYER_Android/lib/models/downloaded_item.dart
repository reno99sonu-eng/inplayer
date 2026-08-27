/// One video/track saved for offline playback — the on-device equivalent
/// of a row in the website's own (not-yet-created) `InPlayer-Downloads`
/// DynamoDB table, but this is the copy that actually matters for
/// playback: the real file lives at [filePath] on this device, not on a
/// server. See DownloadsStore for persistence and DownloadManager for the
/// download flow that produces these.
class DownloadedItem {
  final String videoId;
  final String title;
  final String thumbnailUrl;
  final String uploaderName;
  final bool isMusic;

  /// One of the real Mux static-rendition keys this was saved from:
  /// '1080p' | '720p' | '480p' | 'audio-only'.
  final String quality;

  /// Absolute path to the saved file in this app's private storage.
  final String filePath;
  final int fileSizeBytes;

  /// ISO-8601 timestamp of when the download finished.
  final String downloadedAt;

  const DownloadedItem({
    required this.videoId,
    required this.title,
    required this.thumbnailUrl,
    required this.uploaderName,
    required this.isMusic,
    required this.quality,
    required this.filePath,
    required this.fileSizeBytes,
    required this.downloadedAt,
  });

  factory DownloadedItem.fromJson(Map<String, dynamic> json) {
    return DownloadedItem(
      videoId: json['videoId']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Untitled',
      thumbnailUrl: json['thumbnailUrl']?.toString() ?? '',
      uploaderName: json['uploaderName']?.toString() ?? '',
      isMusic: json['isMusic'] == true,
      quality: json['quality']?.toString() ?? '',
      filePath: json['filePath']?.toString() ?? '',
      fileSizeBytes: (json['fileSizeBytes'] as num?)?.toInt() ?? 0,
      downloadedAt: json['downloadedAt']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'videoId': videoId,
      'title': title,
      'thumbnailUrl': thumbnailUrl,
      'uploaderName': uploaderName,
      'isMusic': isMusic,
      'quality': quality,
      'filePath': filePath,
      'fileSizeBytes': fileSizeBytes,
      'downloadedAt': downloadedAt,
    };
  }

  /// Human-readable quality label matching the site's own wording for these
  /// same three resolutions (app/lib/premium.ts's QUALITY_OPTIONS labels),
  /// plus the audio-only case downloads have that streaming doesn't.
  String get qualityLabel {
    switch (quality) {
      case '1080p':
        return '1080p · Full HD';
      case '720p':
        return '720p · HD';
      case '480p':
        return '480p · Data saver';
      case 'audio-only':
        return 'Audio';
      default:
        return quality;
    }
  }

  String get fileSizeLabel {
    if (fileSizeBytes <= 0) return '';
    final mb = fileSizeBytes / (1024 * 1024);
    if (mb < 1024) return '${mb.toStringAsFixed(mb < 10 ? 1 : 0)} MB';
    return '${(mb / 1024).toStringAsFixed(2)} GB';
  }
}
