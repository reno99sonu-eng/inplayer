import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/video.dart';
import '../models/short.dart';
import '../models/trending_creator.dart';

final videoServiceProvider = Provider<VideoService>((ref) {
  return VideoService();
});

class VideoService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// Loads the real video feed from the InPlayer website backend.
  ///
  /// This is the same `/api/videos` endpoint the website's homepage,
  /// /videos, and channel pages all read from (see app/api/videos/route.ts)
  /// — it returns every public, ready video, newest first.
  Future<List<Video>> getVideos() async {
    try {
      final response = await _dio.get(ApiConstants.videos);

      if (response.statusCode != 200) {
        _logger.w(
          'getVideos returned HTTP ${response.statusCode}',
        );
        return [];
      }

      final data = response.data;

      if (data is! Map) {
        _logger.w('Unexpected /api/videos response format');
        return [];
      }

      final videosJson = data['videos'];

      if (videosJson is! List) {
        _logger.w('No videos array found in /api/videos response');
        return [];
      }

      return videosJson
          .whereType<Map>()
          .map(
            (json) => Video.fromJson(
              Map<String, dynamic>.from(json),
            ),
          )
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching real InPlayer videos',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  /// Loads the real Featured Weekly videos.
  Future<List<Video>> getFeaturedWeekly() async {
    try {
      final response = await _dio.get(
        ApiConstants.featuredWeekly,
      );

      if (response.statusCode != 200) {
        _logger.w(
          'getFeaturedWeekly returned HTTP ${response.statusCode}',
        );
        return [];
      }

      final data = response.data;

      if (data is! Map) {
        return [];
      }

      final videosJson = data['videos'];

      if (videosJson is! List) {
        return [];
      }

      return videosJson
          .whereType<Map>()
          .map(
            (json) => Video.fromJson(
              Map<String, dynamic>.from(json),
            ),
          )
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching featured weekly videos',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  /// Loads the real Trending data.
  ///
  /// The live /api/trending endpoint returns creator/video information
  /// under its "creators" property rather than returning a bare List.
  Future<List<TrendingCreator>> getTrendingCreatorsData() async {
    try {
      final response = await _dio.get(
        ApiConstants.trending,
      );

      if (response.statusCode != 200) {
        _logger.w(
          'getTrendingCreatorsData returned HTTP ${response.statusCode}',
        );
        return [];
      }

      final data = response.data;

      if (data is! Map) {
        return [];
      }

      final creatorsJson = data['creators'];

      if (creatorsJson is! List) {
        return [];
      }

      return creatorsJson
          .whereType<Map>()
          .map(
            (json) => TrendingCreator.fromJson(
              Map<String, dynamic>.from(json),
            ),
          )
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching trending creators',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  Future<List<Video>> getTrendingVideos() async {
    try {
      final response = await _dio.get(
        ApiConstants.trending,
      );

      if (response.statusCode != 200) {
        _logger.w(
          'getTrendingVideos returned HTTP ${response.statusCode}',
        );
        return [];
      }

      final data = response.data;

      if (data is! Map) {
        return [];
      }

      final creatorsJson = data['creators'];

      if (creatorsJson is! List) {
        return [];
      }

      final videos = <Video>[];

      for (final creator in creatorsJson) {
        if (creator is! Map) {
          continue;
        }

        final creatorVideos = creator['videos'];

        if (creatorVideos is List) {
          for (final video in creatorVideos) {
            if (video is Map) {
              videos.add(
                Video.fromJson(
                  Map<String, dynamic>.from(video),
                ),
              );
            }
          }
        }
      }

      return videos;
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching trending videos',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  Future<Video?> getVideoById(String videoId) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.videoDetail}/$videoId',
      );

      if (response.statusCode == 200 &&
          response.data is Map) {
        return Video.fromJson(
          Map<String, dynamic>.from(response.data),
        );
      }

      return null;
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching video by ID: $videoId',
        error: e,
        stackTrace: stackTrace,
      );
      return null;
    }
  }

  Future<String?> getPlaybackToken(String videoId) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.videoPlaybackToken}/$videoId/playback-token',
      );

      if (response.statusCode == 200 &&
          response.data is Map) {
        return response.data['token'] as String?;
      }

      return null;
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching playback token for $videoId',
        error: e,
        stackTrace: stackTrace,
      );
      return null;
    }
  }

  /// Loads real Shorts from the existing InPlayer backend.
  ///
  /// There are intentionally NO sample/dummy Shorts here.
  ///
  /// NOTE: the website has no standalone `/api/shorts` REST endpoint —
  /// app/shorts/page.tsx renders Shorts server-side by filtering the same
  /// video list down to `contentType === "short"`. We reuse `/api/videos`
  /// here and apply that identical filter client-side so the app reads
  /// from real data instead of a route that doesn't exist (which is why
  /// Raftaar/Shorts always came back empty before).
  Future<List<Short>> getShorts() async {
    try {
      final response = await _dio.get(
        ApiConstants.videos,
      );

      if (response.statusCode != 200) {
        _logger.w(
          'getShorts returned HTTP ${response.statusCode}',
        );
        return [];
      }

      final data = response.data;

      if (data is! Map || data['videos'] is! List) {
        _logger.w(
          'Unexpected /api/videos response format for shorts',
        );
        return [];
      }

      final videosJson = data['videos'] as List;

      return videosJson
          .whereType<Map>()
          .map((json) => Map<String, dynamic>.from(json))
          .where((json) => json['contentType'] == 'short')
          .map((json) => Short.fromJson(json))
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching real InPlayer Shorts',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  /// NOTE: the website has no `/api/search` endpoint — its navbar search
  /// box calls `/api/videos/suggest` for lightweight autocomplete
  /// (videoId/title/thumbnail only, see app/api/videos/suggest/route.ts),
  /// not full video cards. To keep returning full `Video` objects (so the
  /// existing search results grid/VideoCard keeps working unchanged), this
  /// reuses `/api/videos` and filters by title client-side instead of
  /// calling a route that returns 404.
  Future<List<Video>> searchVideos(String query) async {
    try {
      final response = await _dio.get(
        ApiConstants.videos,
      );

      if (response.statusCode != 200) {
        return [];
      }

      final data = response.data;

      if (data is! Map || data['videos'] is! List) {
        return [];
      }

      final lowerQuery = query.toLowerCase();

      return (data['videos'] as List)
          .whereType<Map>()
          .map((json) => Map<String, dynamic>.from(json))
          .where(
            (json) => (json['title']?.toString().toLowerCase() ?? '')
                .contains(lowerQuery),
          )
          .map((json) => Video.fromJson(json))
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error searching InPlayer videos',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }

  /// The signed-in user's own uploads (Creator Studio / "My Videos").
  /// GET /api/my-videos (app/api/my-videos/route.ts) — every video where
  /// uploaderId matches the caller, any status/visibility (unlike the
  /// public feed, this includes the owner's own drafts/private videos).
  Future<List<Video>> getMyVideos() async {
    try {
      final response = await _dio.get(ApiConstants.myVideos);

      if (response.statusCode != 200 || response.data is! Map) {
        return [];
      }

      final videosJson = (response.data as Map)['videos'];
      if (videosJson is! List) return [];

      return videosJson
          .whereType<Map>()
          .map((json) => Video.fromJson(Map<String, dynamic>.from(json)))
          .toList();
    } catch (e, stackTrace) {
      _logger.e('Error fetching my videos', error: e, stackTrace: stackTrace);
      return [];
    }
  }

  /// Videos the signed-in user has liked (Profile -> Liked Videos).
  /// GET /api/likes/my-likes (app/api/likes/my-likes/route.ts) returns
  /// full video records (each with an extra `likedAt`), not just IDs.
  Future<List<Video>> getLikedVideos() async {
    try {
      final response = await _dio.get(ApiConstants.myLikes);

      if (response.statusCode != 200 || response.data is! Map) {
        return [];
      }

      final videosJson = (response.data as Map)['videos'];
      if (videosJson is! List) return [];

      return videosJson
          .whereType<Map>()
          .map((json) => Video.fromJson(Map<String, dynamic>.from(json)))
          .toList();
    } catch (e, stackTrace) {
      _logger.e('Error fetching liked videos', error: e, stackTrace: stackTrace);
      return [];
    }
  }

  Future<List<Video>> getVideosByChannel(
    String channelId,
  ) async {
    try {
      final response = await _dio.get(
        ApiConstants.videos,
        queryParameters: {
          'channelId': channelId,
        },
      );

      if (response.statusCode != 200) {
        return [];
      }

      final data = response.data;

      List<dynamic> videosJson;

      if (data is List) {
        videosJson = data;
      } else if (data is Map && data['videos'] is List) {
        videosJson = data['videos'] as List;
      } else {
        return [];
      }

      return videosJson
          .whereType<Map>()
          .map(
            (json) => Video.fromJson(
              Map<String, dynamic>.from(json),
            ),
          )
          .toList();
    } catch (e, stackTrace) {
      _logger.e(
        'Error fetching channel videos',
        error: e,
        stackTrace: stackTrace,
      );
      return [];
    }
  }
}