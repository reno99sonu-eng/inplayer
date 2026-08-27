/// A single lightweight typeahead result from GET /api/videos/suggest
/// (app/api/videos/suggest/route.ts) — deliberately NOT a full [Video]:
/// just enough to render a dropdown row and navigate to /watch/{videoId}
/// on tap. See video_service.dart's getSuggestions() for why this is a
/// separate, additive call rather than a replacement for searchVideos().
class VideoSuggestion {
  final String videoId;
  final String title;
  final String? thumbnailUrl;
  final String contentType;

  const VideoSuggestion({
    required this.videoId,
    required this.title,
    required this.thumbnailUrl,
    required this.contentType,
  });

  factory VideoSuggestion.fromJson(Map<String, dynamic> json) {
    return VideoSuggestion(
      videoId: json['videoId']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      thumbnailUrl: json['thumbnailUrl']?.toString(),
      contentType: json['contentType']?.toString() ?? 'video',
    );
  }
}
