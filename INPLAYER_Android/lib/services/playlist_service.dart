import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/playlist.dart';

final playlistServiceProvider = Provider<PlaylistService>((ref) {
  return PlaylistService();
});

/// Wraps GET/POST /api/playlists (app/api/playlists/route.ts). Every
/// signed-in viewer also has one reserved "saved" playlist created the
/// first time they quick-save a video — the backend excludes it from
/// nothing on GET, but the UI should generally show it as "Saved" rather
/// than a user-created playlist (see `Playlist.reserved`).
class PlaylistService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<List<Playlist>> getPlaylists() async {
    try {
      final response = await _dio.get(ApiConstants.playlists);

      if (response.statusCode != 200 || response.data is! Map) {
        return [];
      }

      final json = (response.data as Map)['playlists'];
      if (json is! List) return [];

      return json
          .whereType<Map>()
          .map((e) => Playlist.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      _logger.e('Error fetching playlists: $e');
      return [];
    }
  }

  /// Creates a new, empty named playlist. Returns the new playlistId, or
  /// null on failure.
  Future<String?> createPlaylist(String name) async {
    try {
      final response = await _dio.post(
        ApiConstants.playlists,
        data: {'action': 'create', 'name': name},
      );

      if (response.statusCode == 200 && response.data is Map) {
        return (response.data as Map)['playlistId'] as String?;
      }
      return null;
    } catch (e) {
      _logger.e('Error creating playlist "$name": $e');
      return null;
    }
  }

  /// Adds (member: true) or removes (member: false) a video from a
  /// playlist. `name` is only used the first time this playlist row is
  /// ever written (upsert) — pass the playlist's display name so a
  /// brand-new row gets a real name instead of the "Playlist" fallback.
  Future<bool> toggleVideo({
    required String playlistId,
    required String videoId,
    required bool member,
    String? name,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.playlists,
        data: {
          'action': 'toggle',
          'playlistId': playlistId,
          'videoId': videoId,
          'member': member,
          'name': ?name,
        },
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error updating playlist $playlistId: $e');
      return false;
    }
  }

  /// Quick-save shelf — adds/removes a video from the viewer's reserved
  /// "Saved" playlist without needing to know its playlistId.
  Future<bool> quickSave(String videoId, {required bool member}) async {
    try {
      final response = await _dio.post(
        ApiConstants.playlists,
        data: {'action': 'quick-save', 'videoId': videoId, 'member': member},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error quick-saving $videoId: $e');
      return false;
    }
  }
}
