/// One row from GET /api/playlists (app/api/playlists/route.ts). Only
/// carries `videoIds` (a set of IDs), not full video objects — a playlist
/// detail screen fetches each video by ID separately.
class Playlist {
  final String playlistId;
  final String name;
  final List<String> videoIds;
  final bool reserved;
  final String? createdAt;

  Playlist({
    required this.playlistId,
    required this.name,
    this.videoIds = const [],
    this.reserved = false,
    this.createdAt,
  });

  factory Playlist.fromJson(Map<String, dynamic> json) {
    final ids = json['videoIds'];
    return Playlist(
      playlistId: json['playlistId']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Playlist',
      videoIds: ids is List ? ids.map((e) => e.toString()).toList() : const [],
      reserved: json['reserved'] == true,
      createdAt: json['createdAt'] as String?,
    );
  }
}
